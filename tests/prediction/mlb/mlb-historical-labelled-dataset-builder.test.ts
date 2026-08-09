import { describe, expect, it } from 'vitest';
import {
  buildMLBHistoricalLabelledDataset,
  type MLBHistoricalLabelledDatasetBuilderInput,
} from '@/prediction/mlb/mlb-historical-labelled-dataset-builder';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import type { CanonicalHistoricalOutcome } from '@/lib/backtesting/mlb/live-history/types';

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';

type SnapshotOverrides = Record<string, unknown>;

function baseSnapshot(overrides: SnapshotOverrides = {}): Record<string, unknown> {
  const defaultGame = {
    gameId: '1',
    scheduledStartAt: FROZEN_SCHEDULED_START,
    officialDate: '2026-07-10',
    season: 2026,
    gameType: 'REGULAR_SEASON' as const,
    status: 'SCHEDULED' as const,
    homeTeamId: 'home-1',
    awayTeamId: 'away-1',
    venueId: 'venue-1',
    neutralSite: false,
    doubleheader: null,
  };
  const snapshotGame = { ...defaultGame, ...(overrides.game as Record<string, unknown> | undefined) };
  const { game: _game, ...restOverrides } = overrides;
  const snapshot: Record<string, unknown> = {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: snapshotGame,
    startingPitchers: {
      home: {
        state: 'PROBABLE' as const,
        pitcherId: 'p-1',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
      },
      away: {
        state: 'PROBABLE' as const,
        pitcherId: 'p-2',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-away'],
      },
    },
    sourceReferences: [
      {
        sourceRefId: 'src-away',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL' as const,
        roles: ['STARTING_PITCHER'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
      {
        sourceRefId: 'src-official',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL' as const,
        roles: ['GAME_IDENTITY'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
    ],
    sections: [
      {
        sectionId: 'sec-1',
        kind: 'GAME_CONTEXT' as const,
        entity: { scope: 'GAME' as const, entityId: null },
        status: 'AVAILABLE' as const,
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {},
      },
    ],
    dataCompleteness: 'COMPLETE' as const,
    warnings: [],
    ...restOverrides,
  };
  snapshot.game = snapshotGame;
  snapshot.capturedAt = snapshot.capturedAt ?? FROZEN_CAPTURED_AT;
  snapshot.dataCutoffAt = snapshot.dataCutoffAt ?? FROZEN_DATA_CUTOFF;
  return snapshot;
}

function coherentSnapshot(overrides: SnapshotOverrides = {}): Record<string, unknown> {
  const game = {
    gameId: '1',
    scheduledStartAt: '2026-07-15T18:00:00Z',
    officialDate: '2026-07-15',
    season: 2026,
    gameType: 'REGULAR_SEASON' as const,
    status: 'SCHEDULED' as const,
    homeTeamId: 'home-1',
    awayTeamId: 'away-1',
    venueId: 'venue-1',
    neutralSite: false,
    doubleheader: null,
    ...(overrides.game as Record<string, unknown> | undefined),
  };
  const scheduledStartAt = game.scheduledStartAt as string;
  const capturedAt = (overrides.capturedAt as string | undefined) ?? `${scheduledStartAt.slice(0, 11)}12:00:00Z`;
  const dataCutoffAt = (overrides.dataCutoffAt as string | undefined) ?? capturedAt;
  const { game: _game, capturedAt: _capturedAt, dataCutoffAt: _dataCutoffAt, ...restOverrides } = overrides;
  const snapshot: Record<string, unknown> = {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId: 'snapshot-1',
    capturedAt,
    dataCutoffAt,
    game,
    startingPitchers: {
      home: {
        state: 'PROBABLE' as const,
        pitcherId: 'p-1',
        announcedAt: dataCutoffAt,
        sourceRefIds: ['src-official'],
      },
      away: {
        state: 'PROBABLE' as const,
        pitcherId: 'p-2',
        announcedAt: dataCutoffAt,
        sourceRefIds: ['src-away'],
      },
    },
    sourceReferences: [
      {
        sourceRefId: 'src-away',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL' as const,
        roles: ['STARTING_PITCHER'],
        providerRecordId: null,
        fetchedAt: capturedAt,
        sourceUpdatedAt: dataCutoffAt,
      },
      {
        sourceRefId: 'src-official',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL' as const,
        roles: ['GAME_IDENTITY'],
        providerRecordId: null,
        fetchedAt: capturedAt,
        sourceUpdatedAt: dataCutoffAt,
      },
    ],
    sections: [
      {
        sectionId: 'sec-1',
        kind: 'GAME_CONTEXT' as const,
        entity: { scope: 'GAME' as const, entityId: null },
        status: 'AVAILABLE' as const,
        asOfAt: dataCutoffAt,
        sourceRefIds: ['src-official'],
        payload: {},
      },
    ],
    dataCompleteness: 'COMPLETE' as const,
    warnings: [],
    ...restOverrides,
  };
  snapshot.game = game;
  snapshot.capturedAt = capturedAt;
  snapshot.dataCutoffAt = dataCutoffAt;
  return snapshot;
}

function validOutcome(overrides: unknown = {}): CanonicalHistoricalOutcome {
  return {
    gamePk: 1,
    status: 'FINAL',
    homeScore: 5,
    awayScore: 3,
    winner: 'HOME',
    innings: 9,
    completedAt: new Date('2026-07-15T12:05:00Z'),
    completedAtSource: 'LAST_COMPLETED_PLAY_END',
    warnings: [],
    ...(overrides as Record<string, unknown>),
  } as CanonicalHistoricalOutcome;
}

function labelSource(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceName: 'Official MLB',
    sourceRecordId: 'rec-1',
    fetchedAt: '2026-07-15T12:06:00Z',
    ...overrides,
  };
}

function baseEntry(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    split: 'TRAIN' as const,
    snapshot: baseSnapshot(),
    outcome: validOutcome(),
    labelSource: labelSource(),
    reconstructedAt: '2026-07-15T12:04:00Z',
    ...overrides,
  };
}

function baseInput(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    datasetId: 'dataset-1',
    createdAt: '2026-07-15T12:06:00Z',
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-14' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
      test: { startDate: '2026-07-22', endDate: '2026-07-31' },
    },
    entries: [baseEntry()],
    ...overrides,
  };
}

function typedInput(
  overrides: Record<string, unknown> = {},
): MLBHistoricalLabelledDatasetBuilderInput {
  return baseInput(overrides) as MLBHistoricalLabelledDatasetBuilderInput;
}

function run(input: MLBHistoricalLabelledDatasetBuilderInput) {
  return buildMLBHistoricalLabelledDataset(input);
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) {
    Object.freeze(value);
    Object.getOwnPropertyNames(value).forEach((key) => {
      deepFreeze((value as Record<string, unknown>)[key]);
    });
  }
  return value;
}

describe('mlb-historical-labelled-dataset-builder', () => {
  it('valid single example builds a valid dataset', () => {
    const result = run(typedInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples).toHaveLength(1);
    }
  });

  it('multiple valid examples build successfully', () => {
    const result = run(
      typedInput({
        createdAt: '2026-07-25T22:00:00Z',
        entries: [
          baseEntry({
            split: 'TRAIN' as const,
            snapshot: coherentSnapshot({ snapshotId: 'a', game: { gameId: '10', officialDate: '2026-07-01', scheduledStartAt: '2026-07-01T18:00:00Z' } }),
            outcome: validOutcome({ gamePk: 10, completedAt: new Date('2026-07-01T21:30:00Z') }),
            labelSource: labelSource({ fetchedAt: '2026-07-01T21:35:00Z' }),
            reconstructedAt: '2026-07-01T21:31:00Z',
          }),
          baseEntry({
            split: 'TEST' as const,
            snapshot: coherentSnapshot({ snapshotId: 'b', game: { gameId: '20', officialDate: '2026-07-25', scheduledStartAt: '2026-07-25T18:00:00Z' } }),
            outcome: validOutcome({ gamePk: 20, completedAt: new Date('2026-07-25T21:30:00Z') }),
            labelSource: labelSource({ fetchedAt: '2026-07-25T21:35:00Z' }),
            reconstructedAt: '2026-07-25T21:31:00Z',
          }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples).toHaveLength(2);
      expect(result.value.examples[0].snapshot.snapshotId).toBe('a');
      expect(result.value.examples[1].snapshot.snapshotId).toBe('b');
    }
  });

  it('output matches the historical dataset contract shape', () => {
    const result = run(typedInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe('mlb-historical-labelled-dataset-v1');
      expect(result.value.sport).toBe('MLB');
      expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    }
  });

  it('snapshot is preserved deeply unchanged', () => {
    const snapshot = deepFreeze(baseSnapshot());
    const outcome = validOutcome();
    const result = run(
      typedInput({
        entries: [
          baseEntry({
            snapshot,
            outcome,
          }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].snapshot).toBe(snapshot);
    }
  });

  it('reconstruction cutoffAt equals snapshot dataCutoffAt', () => {
    const result = run(typedInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].reconstruction.cutoffAt).toBe(FROZEN_DATA_CUTOFF);
    }
  });

  it('reconstructedAt preserved exactly', () => {
    const reconstructedAt = '2026-07-15T12:04:00Z';
    const result = run(
      typedInput({
        entries: [baseEntry({ reconstructedAt })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].reconstruction.reconstructedAt).toBe(reconstructedAt);
    }
  });

  it('reconstructedAt before snapshot.capturedAt rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ reconstructedAt: '2026-07-15T09:59:59Z' })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.entries[0].reconstruction.reconstructedAt' }),
        ]),
      );
    }
  });

  it('reconstructedAt after dataset.createdAt rejected', () => {
    const result = run(
      typedInput({
        createdAt: '2026-07-15T12:00:00Z',
        entries: [baseEntry({ reconstructedAt: '2026-07-15T12:07:00Z' })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.entries[0].reconstruction.reconstructedAt' }),
        ]),
      );
    }
  });

  it('official-final timestamp preserved as label.finalizedAt', () => {
    const completedAt = new Date('2026-07-15T12:05:00Z');
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ completedAt }) })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].label.finalizedAt).toBe(completedAt.toISOString());
    }
  });

  it('finalizedAt before scheduled start rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ completedAt: new Date('2026-07-15T11:59:59Z') }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.entries[0].label.finalizedAt' }),
        ]),
      );
    }
  });

  it('finalizedAt before dataCutoffAt rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ completedAt: new Date('2026-07-15T08:59:59Z') }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.entries[0].label.finalizedAt' }),
        ]),
      );
    }
  });

  it('label source fetchedAt preserved exactly', () => {
    const fetchedAt = '2026-07-15T12:06:00Z';
    const result = run(
      typedInput({
        entries: [baseEntry({ labelSource: labelSource({ fetchedAt }) })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].label.source.fetchedAt).toBe(fetchedAt);
    }
  });

  it('label source fetchedAt before finalizedAt rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ labelSource: labelSource({ fetchedAt: '2026-07-15T12:04:59Z' }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.entries[0].label.source.fetchedAt' }),
        ]),
      );
    }
  });

  it('label source fetchedAt after dataset.createdAt rejected', () => {
    const result = run(
      typedInput({
        createdAt: '2026-07-15T12:06:00Z',
        entries: [baseEntry({ labelSource: labelSource({ fetchedAt: '2026-07-15T12:07:00Z' }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.entries[0].label.source.fetchedAt' }),
        ]),
      );
    }
  });

  it('HOME final outcome maps winnerTeamId to exact snapshot homeTeamId', () => {
    const result = run(
      typedInput({
        entries: [
          baseEntry({
            split: 'TRAIN' as const,
            snapshot: baseSnapshot({ game: { gameId: '100', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-team', awayTeamId: 'away-team', venueId: 'venue-1', neutralSite: false, doubleheader: null } }),
            outcome: validOutcome({ gamePk: 100 }),
          }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].label.winnerTeamId).toBe('home-team');
    }
  });

  it('AWAY final outcome maps winnerTeamId to exact snapshot awayTeamId', () => {
    const result = run(
      typedInput({
        entries: [
          baseEntry({
            split: 'TRAIN' as const,
            snapshot: baseSnapshot({ game: { gameId: '200', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-team', awayTeamId: 'away-team', venueId: 'venue-1', neutralSite: false, doubleheader: null } }),
            outcome: validOutcome({ gamePk: 200, winner: 'AWAY' as const, homeScore: 2, awayScore: 8 }),
          }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].label.winnerTeamId).toBe('away-team');
    }
  });

  it('home score mapped exactly', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ homeScore: 7, awayScore: 2 }) })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].label.homeRuns).toBe(7);
    }
  });

  it('away score mapped exactly', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ homeScore: 2, awayScore: 8, winner: 'AWAY' as const }) })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].label.awayRuns).toBe(8);
    }
  });

  it('tied final score rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ homeScore: 4, awayScore: 4 }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_FINAL_LABEL', path: '$.entries[0].outcome.homeScore' }),
        ]),
      );
    }
  });

  it('non-final outcome rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ status: 'UPCOMING' as const }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_LITERAL', path: '$.entries[0].outcome.status' }),
        ]),
      );
    }
  });

  it('LIVE outcome rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ status: 'LIVE' as const }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_LITERAL', path: '$.entries[0].outcome.status' }),
        ]),
      );
    }
  });

  it('POSTPONED outcome rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ status: 'POSTPONED' as const }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_LITERAL', path: '$.entries[0].outcome.status' }),
        ]),
      );
    }
  });

  it('CANCELLED outcome rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ status: 'CANCELLED' as const }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_LITERAL', path: '$.entries[0].outcome.status' }),
        ]),
      );
    }
  });

  it('missing official winner rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: validOutcome({ winner: null as unknown as 'HOME' | 'AWAY' | null }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_FIELD', path: '$.entries[0].outcome.winner' }),
        ]),
      );
    }
  });

  it('snapshot outcome game identity mismatch rejected', () => {
    const result = run(
      typedInput({
        entries: [
          baseEntry({
            split: 'TRAIN' as const,
            snapshot: baseSnapshot({ game: { gameId: 'game-2', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } }),
            outcome: validOutcome({ gamePk: 999 }),
          }),
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'SNAPSHOT_INVALID', path: '$.entries[0].snapshot' }),
        ]),
      );
    }
  });

  it('deterministic example IDs stable across equivalent inputs', () => {
    const snapshot = baseSnapshot({ snapshotId: 'snap-stable', game: { gameId: '1', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } });
    const input1 = typedInput({ entries: [baseEntry({ split: 'TRAIN' as const, snapshot })] });
    const input2 = typedInput({ entries: [baseEntry({ split: 'TRAIN' as const, snapshot })] });
    const result1 = run(input1);
    const result2 = run(input2);
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      expect(result1.value.examples[0].exampleId).toBe(result2.value.examples[0].exampleId);
    }
  });

  it('identity changes only when relevant semantic identity changes', () => {
    const snapshotA = baseSnapshot({ snapshotId: 'snap-a', game: { gameId: '1', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } });
    const snapshotB = baseSnapshot({ snapshotId: 'snap-b', game: { gameId: '1', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } });
    const inputA = typedInput({ entries: [baseEntry({ split: 'TRAIN' as const, snapshot: snapshotA })] });
    const inputB = typedInput({ entries: [baseEntry({ split: 'TRAIN' as const, snapshot: snapshotB })] });
    const resultA = run(inputA);
    const resultB = run(inputB);
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (resultA.ok && resultB.ok) {
      expect(resultA.value.examples[0].exampleId).not.toBe(resultB.value.examples[0].exampleId);
    }
  });

  it('no random current-clock identity', () => {
    const before = Date.now();
    const result = run(typedInput());
    const after = Date.now();
    expect(result.ok).toBe(true);
    if (result.ok) {
      const exampleId = result.value.examples[0].exampleId;
      expect(exampleId).not.toMatch(/^\d+$/);
      expect(exampleId).not.toContain(String(before));
      expect(exampleId).not.toContain(String(after));
    }
  });

  it('invalid snapshot rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ snapshot: baseSnapshot({ sport: 'NFL' }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'SNAPSHOT_INVALID', path: '$.entries[0].snapshot' }),
        ]),
      );
    }
  });

  it('no label data inserted into snapshot', () => {
    const snapshot = baseSnapshot();
    const result = run(
      typedInput({
        entries: [baseEntry({ snapshot })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const outputSnapshot = result.value.examples[0].snapshot;
      expect(outputSnapshot).toBe(snapshot);
      expect((outputSnapshot as Record<string, unknown>).homeRuns).toBeUndefined();
      expect((outputSnapshot as Record<string, unknown>).awayRuns).toBeUndefined();
      expect((outputSnapshot as Record<string, unknown>).winnerTeamId).toBeUndefined();
      expect((outputSnapshot as Record<string, unknown>).finalizedAt).toBeUndefined();
    }
  });

  it('no probability prediction fields appear in output', () => {
    const result = run(typedInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const datasetJson = JSON.stringify(result.value);
      expect(datasetJson).not.toContain('homeWinProbability');
      expect(datasetJson).not.toContain('awayWinProbability');
      expect(datasetJson).not.toContain('predictedSide');
      expect(datasetJson).not.toContain('predictedTeamId');
      expect(datasetJson).not.toContain('recommendation');
      expect(datasetJson).not.toContain('stake');
    }
  });

  it('no sportsbook market fields appear in output', () => {
    const result = run(typedInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const datasetJson = JSON.stringify(result.value);
      expect(datasetJson).not.toContain('sportsbook');
      expect(datasetJson).not.toContain('moneyline');
      expect(datasetJson).not.toContain('betting');
      expect(datasetJson).not.toContain('market');
      expect(datasetJson).not.toContain('edge');
      expect(datasetJson).not.toContain('Kelly');
    }
  });

  it('caller inputs remain unchanged', () => {
    const originalSnapshot = baseSnapshot();
    const originalOutcome = validOutcome();
    const originalSource = labelSource();
    const originalEntry = baseEntry({ snapshot: originalSnapshot, outcome: originalOutcome, labelSource: originalSource });
    const originalInput = baseInput({
      entries: [originalEntry],
    });
    const typedOriginalInput = typedInput({
      entries: [originalEntry],
    });
    run(typedOriginalInput);
    const originalEntries = typedOriginalInput.entries as unknown as MLBHistoricalLabelledDatasetBuilderInput['entries'];
    expect(originalEntries[0].snapshot).toBe(originalSnapshot);
    expect(originalEntries[0].outcome).toBe(originalOutcome);
    expect(originalEntries[0].labelSource).toBe(originalSource);
    expect(originalEntries[0].reconstructedAt).toBe('2026-07-15T12:04:00Z');
  });

  it('dataset createdAt is caller-owned and preserved', () => {
    const createdAt = '2026-07-15T12:06:00Z';
    const result = run(typedInput({ createdAt }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.createdAt).toBe(createdAt);
    }
  });

  it('empty input rejected', () => {
    const result = run(
      typedInput({ entries: [] }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_FIELD', path: '$.entries', message: 'entries must be a non-empty array' }),
        ]),
      );
    }
  });

  it('reconstructedAt does not appear in canonical snapshot', () => {
    const result = run(typedInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const snapshot = result.value.examples[0].snapshot as Record<string, unknown>;
      expect(snapshot.reconstructedAt).toBeUndefined();
    }
  });

  it('label fetchedAt may occur long after historical game and remains truthful', () => {
    const fetchedAt = '2030-01-01T00:00:00Z';
    const result = run(
      typedInput({
        createdAt: '2030-01-01T00:01:00Z',
        entries: [baseEntry({ labelSource: labelSource({ sourceName: 'Archive', sourceRecordId: 'arch-1', fetchedAt }) })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].label.source.fetchedAt).toBe(fetchedAt);
    }
  });

  it('output remains feature-manifest independent', () => {
    const result = run(typedInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      const datasetJson = JSON.stringify(result.value);
      expect(datasetJson).not.toContain('featureManifest');
      expect(datasetJson).not.toContain('manifestId');
      expect(datasetJson).not.toContain('featureVector');
    }
  });

  it('no training split invented', () => {
    const result = run(
      typedInput({
        createdAt: '2026-07-25T22:00:00Z',
        entries: [
          baseEntry({ split: 'TRAIN' as const, snapshot: coherentSnapshot({ snapshotId: 's-1', game: { gameId: '1', officialDate: '2026-07-01', scheduledStartAt: '2026-07-01T18:00:00Z' } }), outcome: validOutcome({ gamePk: 1, completedAt: new Date('2026-07-01T21:30:00Z') }), labelSource: labelSource({ fetchedAt: '2026-07-01T21:35:00Z' }), reconstructedAt: '2026-07-01T21:31:00Z' }),
          baseEntry({ split: 'VALIDATION' as const, snapshot: coherentSnapshot({ snapshotId: 's-2', game: { gameId: '2', officialDate: '2026-07-16', scheduledStartAt: '2026-07-16T18:00:00Z' } }), outcome: validOutcome({ gamePk: 2, completedAt: new Date('2026-07-16T21:30:00Z') }), labelSource: labelSource({ fetchedAt: '2026-07-16T21:35:00Z' }), reconstructedAt: '2026-07-16T21:31:00Z' }),
          baseEntry({ split: 'TEST' as const, snapshot: coherentSnapshot({ snapshotId: 's-3', game: { gameId: '3', officialDate: '2026-07-25', scheduledStartAt: '2026-07-25T18:00:00Z' } }), outcome: validOutcome({ gamePk: 3, completedAt: new Date('2026-07-25T21:30:00Z') }), labelSource: labelSource({ fetchedAt: '2026-07-25T21:35:00Z' }), reconstructedAt: '2026-07-25T21:31:00Z' }),
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].split).toBe('TRAIN');
      expect(result.value.examples[1].split).toBe('VALIDATION');
      expect(result.value.examples[2].split).toBe('TEST');
    }
  });

  it('example ordering deterministic', () => {
    const entries = [
      baseEntry({
        split: 'TEST' as const,
        snapshot: baseSnapshot({ snapshotId: 'z', game: { gameId: '30', officialDate: '2026-07-30', scheduledStartAt: FROZEN_SCHEDULED_START, season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } }),
        outcome: validOutcome({ gamePk: 30, completedAt: new Date('2026-07-15T12:05:00Z') }),
      }),
      baseEntry({
        split: 'TRAIN' as const,
        snapshot: baseSnapshot({ snapshotId: 'a', game: { gameId: '10', officialDate: '2026-07-01', scheduledStartAt: FROZEN_SCHEDULED_START, season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } }),
        outcome: validOutcome({ gamePk: 10, completedAt: new Date('2026-07-15T12:05:00Z') }),
      }),
    ];
    const result = run(typedInput({ entries }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].split).toBe('TRAIN');
      expect(result.value.examples[1].split).toBe('TEST');
    }
  });

  it('reversed input order yields deeply equivalent output', () => {
    const entryA = baseEntry({
      split: 'TRAIN' as const,
      snapshot: coherentSnapshot({ snapshotId: 'a', game: { gameId: '10', officialDate: '2026-07-01', scheduledStartAt: '2026-07-01T18:00:00Z' } }),
      outcome: validOutcome({ gamePk: 10, completedAt: new Date('2026-07-01T21:30:00Z') }),
      labelSource: labelSource({ fetchedAt: '2026-07-01T21:35:00Z' }),
      reconstructedAt: '2026-07-01T21:31:00Z',
    });
    const entryB = baseEntry({
      split: 'TEST' as const,
      snapshot: coherentSnapshot({ snapshotId: 'b', game: { gameId: '20', officialDate: '2026-07-25', scheduledStartAt: '2026-07-25T18:00:00Z' } }),
      outcome: validOutcome({ gamePk: 20, completedAt: new Date('2026-07-25T21:30:00Z') }),
      labelSource: labelSource({ fetchedAt: '2026-07-25T21:35:00Z' }),
      reconstructedAt: '2026-07-25T21:31:00Z',
    });
    const result1 = run(typedInput({ createdAt: '2026-07-25T22:00:00Z', entries: [entryA, entryB] }));
    const result2 = run(typedInput({ createdAt: '2026-07-25T22:00:00Z', entries: [entryB, entryA] }));
    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      expect(result1.value).toEqual(result2.value);
    }
  });

  it('duplicate gameIds rejected', () => {
    const snapshot = baseSnapshot({ snapshotId: 'dup', game: { gameId: '1', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } });
    const result = run(
      typedInput({
        entries: [
          baseEntry({ split: 'TRAIN' as const, snapshot, outcome: validOutcome({ gamePk: 1, completedAt: new Date('2026-07-15T12:05:00Z') }) }),
          baseEntry({ split: 'TEST' as const, snapshot, outcome: validOutcome({ gamePk: 1, completedAt: new Date('2026-07-15T12:05:00Z') }) }),
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'DUPLICATE_GAME', path: '$.entries[1].snapshot.game.gameId' }),
        ]),
      );
    }
  });

  it('contradictory duplicate labels rejected', () => {
    const snapshot = baseSnapshot({ snapshotId: 'dup-label', game: { gameId: '1', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } });
    const result = run(
      typedInput({
        entries: [
          baseEntry({ split: 'TRAIN' as const, snapshot, outcome: validOutcome({ gamePk: 1, homeScore: 5, awayScore: 3, winner: 'HOME', completedAt: new Date('2026-07-15T12:05:00Z') }) }),
          baseEntry({ split: 'TEST' as const, snapshot, outcome: validOutcome({ gamePk: 1, homeScore: 3, awayScore: 5, winner: 'AWAY', completedAt: new Date('2026-07-15T12:05:00Z') }) }),
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'DUPLICATE_GAME', path: '$.entries[1].snapshot.game.gameId' }),
        ]),
      );
    }
  });

  it('invalid split rejected', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ split: 'INVALID' as const })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_LITERAL', path: '$.examples[0].split' }),
        ]),
      );
    }
  });

  it('odds contamination rejected via final validation', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ snapshot: baseSnapshot({ modelProbability: 0.8 }) })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'SNAPSHOT_INVALID' }),
        ]),
      );
    }
  });

  it('unknown outcome fields do not affect builder output', () => {
    const outcome = validOutcome();
    (outcome as unknown as Record<string, unknown>).finalScore = 10;
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: outcome as unknown as Record<string, unknown> })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].label.homeRuns).toBe(5);
      expect(result.value.examples[0].label.awayRuns).toBe(3);
    }
  });

  it('label source unknown fields do not affect builder output', () => {
    const result = run(
      typedInput({
        entries: [baseEntry({ labelSource: labelSource({ sourceRecordId: 'rec-1', fetchedAt: '2026-07-15T12:06:00Z', extra: true }) })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].label.source.sourceName).toBe('Official MLB');
      expect(result.value.examples[0].label.source.sourceRecordId).toBe('rec-1');
    }
  });

  it('multiple issues reported for multiple invalid entries', () => {
    const result = run(
      typedInput({
        entries: [
          baseEntry({ outcome: validOutcome({ status: 'LIVE' as const, gamePk: 101 }), snapshot: baseSnapshot({ snapshotId: 'snap-1', game: { gameId: '101', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } }) }),
          baseEntry({ reconstructedAt: '2026-07-15T09:59:59Z', snapshot: baseSnapshot({ snapshotId: 'snap-2', game: { gameId: '102', scheduledStartAt: FROZEN_SCHEDULED_START, officialDate: '2026-07-10', season: 2026, gameType: 'REGULAR_SEASON' as const, status: 'SCHEDULED' as const, homeTeamId: 'home-1', awayTeamId: 'away-1', venueId: 'venue-1', neutralSite: false, doubleheader: null } }), outcome: validOutcome({ gamePk: 102 }) }),
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThanOrEqual(2);
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_LITERAL', path: '$.entries[0].outcome.status' }),
          expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.entries[1].reconstruction.reconstructedAt' }),
        ]),
      );
    }
  });

  it('snapshot source references preserved exactly', () => {
    const snapshot = baseSnapshot();
    const result = run(
      typedInput({
        entries: [baseEntry({ snapshot })],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.examples[0].snapshot.sourceReferences).toBe(snapshot.sourceReferences);
    }
  });

  it('dataset ID preserved exactly', () => {
    const datasetId = 'exact-dataset-id';
    const result = run(typedInput({ datasetId }));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.datasetId).toBe(datasetId);
    }
  });

  it('winner and score mismatch rejected', () => {
    const result = run(
      typedInput({
        entries: [
          baseEntry({
            outcome: validOutcome({ winner: 'HOME' as const, homeScore: 3, awayScore: 5 }),
          }),
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'FINAL_SCORE_MISMATCH', path: '$.entries[0].outcome.winnerTeamId' }),
        ]),
      );
    }
  });

  it('missing outcome scores rejected', () => {
    const outcome = validOutcome({ homeScore: null, awayScore: null } as unknown as CanonicalHistoricalOutcome);
    const result = run(
      typedInput({
        entries: [baseEntry({ outcome: outcome as unknown as Record<string, unknown> })],
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'MISSING_FIELD', path: '$.entries[0].outcome.homeScore' }),
        ]),
      );
    }
  });

  it('invalid datasetId rejected', () => {
    const result = run(typedInput({ datasetId: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_STRING', path: '$.datasetId' }),
        ]),
      );
    }
  });

  it('invalid createdAt rejected', () => {
    const result = run(typedInput({ createdAt: 'not-a-timestamp' }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_TIMESTAMP', path: '$.createdAt' }),
        ]),
      );
      const timeOrderIssues = result.issues.filter((issue) => issue.code === 'INVALID_TIME_ORDER');
      expect(timeOrderIssues).toHaveLength(0);
    }
  });
});
