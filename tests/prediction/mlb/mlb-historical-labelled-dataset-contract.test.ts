import { describe, expect, it } from 'vitest';
import {
  validateMLBHistoricalLabelledDataset,
  MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-historical-labelled-dataset-contract';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';

function buildValidSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-1',
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
    },
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
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidLabelSource(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sourceName: 'Official MLB',
    sourceRecordId: 'rec-1',
    fetchedAt: '2026-07-15T12:05:00Z',
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidFinalLabel(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    status: 'OFFICIAL_FINAL' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    homeRuns: 5,
    awayRuns: 3,
    winnerTeamId: 'home-1',
    finalizedAt: '2026-07-15T12:05:00Z',
    source: buildValidLabelSource(),
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidReconstruction(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    mode: 'POINT_IN_TIME_AS_OF_CUTOFF' as const,
    cutoffAt: FROZEN_DATA_CUTOFF,
    reconstructedAt: '2026-07-15T12:04:00Z',
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidExample(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    exampleId: 'example-1',
    split: 'TRAIN' as const,
    snapshot: buildValidSnapshot(),
    reconstruction: buildValidReconstruction(),
    label: buildValidFinalLabel(),
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidDataset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const trainSnapshot = buildValidSnapshot({
    snapshotId: 'snapshot-train',
    game: {
      gameId: 'game-train',
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
    },
  });
  const validationSnapshot = buildValidSnapshot({
    snapshotId: 'snapshot-val',
    game: {
      gameId: 'game-val',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: '2026-07-18',
      season: 2026,
      gameType: 'REGULAR_SEASON' as const,
      status: 'SCHEDULED' as const,
      homeTeamId: 'home-1',
      awayTeamId: 'away-1',
      venueId: 'venue-1',
      neutralSite: false,
      doubleheader: null,
    },
  });
  const testSnapshot = buildValidSnapshot({
    snapshotId: 'snapshot-test',
    game: {
      gameId: 'game-test',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: '2026-07-25',
      season: 2026,
      gameType: 'REGULAR_SEASON' as const,
      status: 'SCHEDULED' as const,
      homeTeamId: 'home-1',
      awayTeamId: 'away-1',
      venueId: 'venue-1',
      neutralSite: false,
      doubleheader: null,
    },
  });
  return {
    contractVersion: MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    datasetId: 'dataset-1',
    createdAt: '2026-07-15T12:06:00Z',
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-14' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
      test: { startDate: '2026-07-22', endDate: '2026-07-31' },
    },
    examples: [
      buildValidExample({ exampleId: 'train-1', split: 'TRAIN' as const, snapshot: trainSnapshot }),
      buildValidExample({ exampleId: 'val-1', split: 'VALIDATION' as const, snapshot: validationSnapshot }),
      buildValidExample({ exampleId: 'test-1', split: 'TEST' as const, snapshot: testSnapshot }),
    ],
    ...overrides,
  } as Record<string, unknown>;
}

describe('mlb-historical-labelled-dataset-contract', () => {
  it('accepts a minimal valid labelled dataset and returns the original reference', () => {
    const dataset = buildValidDataset();
    const result = validateMLBHistoricalLabelledDataset(dataset);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(dataset);
    }
  });

  it('validates exact root fields, literals, version, sport, target, and dataset ID', () => {
    expect(validateMLBHistoricalLabelledDataset(buildValidDataset({ contractVersion: 'wrong' })).ok).toBe(false);
    expect(validateMLBHistoricalLabelledDataset(buildValidDataset({ sport: 'NFL' })).ok).toBe(false);
    expect(validateMLBHistoricalLabelledDataset(buildValidDataset({ target: 'REGULATION_ONLY' })).ok).toBe(false);
    expect(validateMLBHistoricalLabelledDataset(buildValidDataset({ datasetId: '' })).ok).toBe(false);
    const unknownRoot = buildValidDataset({ mysteryField: true } as Record<string, unknown>);
    const result = validateMLBHistoricalLabelledDataset(unknownRoot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'UNKNOWN_FIELD', path: '$.mysteryField' })]),
      );
    }
  });

  it('validates split-window exact fields and real Gregorian dates', () => {
    const badWindow = buildValidDataset({
      splitPolicy: {
        strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
        embargoDays: 0,
        train: { startDate: '2026-07-01', endDate: '2026-07-14' },
        validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
        test: { startDate: '2026-07-22', endDate: 'invalid-date' },
      },
    });
    expect(validateMLBHistoricalLabelledDataset(badWindow).ok).toBe(false);
  });

  it('rejects overlapping or reversed chronological split windows', () => {
    const overlapping = buildValidDataset({
      splitPolicy: {
        strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
        embargoDays: 0,
        train: { startDate: '2026-07-01', endDate: '2026-07-18' },
        validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
        test: { startDate: '2026-07-22', endDate: '2026-07-31' },
      },
    });
    expect(validateMLBHistoricalLabelledDataset(overlapping).ok).toBe(false);
    const reversed = buildValidDataset({
      splitPolicy: {
        strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
        embargoDays: 0,
        train: { startDate: '2026-07-16', endDate: '2026-07-14' },
        validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
        test: { startDate: '2026-07-22', endDate: '2026-07-31' },
      },
    });
    expect(validateMLBHistoricalLabelledDataset(reversed).ok).toBe(false);
  });

  it('enforces exclusive-calendar-day embargo gaps', () => {
    const tightEmbargo = buildValidDataset({
      splitPolicy: {
        strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
        embargoDays: 2,
        train: { startDate: '2026-07-01', endDate: '2026-07-14' },
        validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
        test: { startDate: '2026-07-22', endDate: '2026-07-31' },
      },
    });
    expect(validateMLBHistoricalLabelledDataset(tightEmbargo).ok).toBe(false);
  });

  it('validates example exact fields and split literals', () => {
    const badExample = buildValidDataset({
      examples: [
        buildValidExample({ split: 'INVALID' as const }),
      ],
    });
    expect(validateMLBHistoricalLabelledDataset(badExample).ok).toBe(false);
  });

  it('integrates the Phase 8C snapshot validator and rejects an invalid snapshot', () => {
    const badSnapshot = buildValidSnapshot({ sport: 'NFL' });
    const dataset = buildValidDataset({
      examples: [buildValidExample({ snapshot: badSnapshot })],
    });
    const result = validateMLBHistoricalLabelledDataset(dataset);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'SNAPSHOT_INVALID', path: '$.examples[0].snapshot' })]),
      );
    }
  });

  it('requires reconstruction cutoff text to equal snapshot dataCutoffAt exactly', () => {
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          reconstruction: buildValidReconstruction({ cutoffAt: '2026-07-15T09:00:01Z' }),
        }),
      ],
    });
    const result = validateMLBHistoricalLabelledDataset(dataset);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'RECONSTRUCTION_CUTOFF_MISMATCH', path: '$.examples[0].reconstruction.cutoffAt' })]),
      );
    }
  });

  it('validates reconstruction and dataset-created timestamp ordering', () => {
    const lowerBoundDataset = buildValidDataset({
      createdAt: '2026-07-15T09:00:00Z',
      examples: [
        buildValidExample({
          reconstruction: buildValidReconstruction({ reconstructedAt: '2026-07-15T08:00:00Z' }),
          label: buildValidFinalLabel({ source: buildValidLabelSource({ fetchedAt: '2026-07-15T08:00:00Z' }) }),
        }),
      ],
    });
    const lowerBoundResult = validateMLBHistoricalLabelledDataset(lowerBoundDataset);
    expect(lowerBoundResult.ok).toBe(false);
    if (!lowerBoundResult.ok) {
      expect(lowerBoundResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.examples[0].reconstruction' })]),
      );
    }

    const missingCreatedAt = buildValidDataset({});
    delete (missingCreatedAt as Record<string, unknown>).createdAt;
    missingCreatedAt.examples = [
      buildValidExample({
        reconstruction: buildValidReconstruction({ reconstructedAt: '2026-07-15T12:04:00Z' }),
        label: buildValidFinalLabel({ source: buildValidLabelSource({ fetchedAt: '2026-07-15T12:05:00Z' }) }),
      }),
    ];
    const missingResult = validateMLBHistoricalLabelledDataset(missingCreatedAt);
    expect(missingResult.ok).toBe(false);
    if (!missingResult.ok) {
      expect(missingResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'MISSING_FIELD', path: '$.createdAt' })]),
      );
    }
    if (!missingResult.ok) {
      const timeOrderIssues = missingResult.issues.filter((issue) => issue.code === 'INVALID_TIME_ORDER');
      expect(timeOrderIssues).toHaveLength(0);
    }

    const invalidCreatedAt = buildValidDataset({
      createdAt: 'invalid',
      examples: [
        buildValidExample({
          reconstruction: buildValidReconstruction({ reconstructedAt: '2026-07-15T12:04:00Z' }),
          label: buildValidFinalLabel({ source: buildValidLabelSource({ fetchedAt: '2026-07-15T12:05:00Z' }) }),
        }),
      ],
    } as unknown as Record<string, unknown>);
    const invalidResult = validateMLBHistoricalLabelledDataset(invalidCreatedAt);
    expect(invalidResult.ok).toBe(false);
    if (!invalidResult.ok) {
      expect(invalidResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_TIMESTAMP', path: '$.createdAt' })]),
      );
    }
    if (!invalidResult.ok) {
      const timeOrderIssues = invalidResult.issues.filter((issue) => issue.code === 'INVALID_TIME_ORDER');
      expect(timeOrderIssues).toHaveLength(0);
    }

    const noTimezoneCreatedAt = buildValidDataset({
      createdAt: '2026-07-15T12:06:00',
      examples: [
        buildValidExample({
          reconstruction: buildValidReconstruction({ reconstructedAt: '2026-07-15T12:04:00Z' }),
          label: buildValidFinalLabel({ source: buildValidLabelSource({ fetchedAt: '2026-07-15T12:05:00Z' }) }),
        }),
      ],
    } as unknown as Record<string, unknown>);
    const noTzResult = validateMLBHistoricalLabelledDataset(noTimezoneCreatedAt);
    expect(noTzResult.ok).toBe(false);
    if (!noTzResult.ok) {
      expect(noTzResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_TIMESTAMP', path: '$.createdAt' })]),
      );
    }
    if (!noTzResult.ok) {
      const timeOrderIssues = noTzResult.issues.filter((issue) => issue.code === 'INVALID_TIME_ORDER');
      expect(timeOrderIssues).toHaveLength(0);
    }

    const spacePaddedCreatedAt = buildValidDataset({
      createdAt: ' 2026-07-15T12:06:00Z ',
      examples: [
        buildValidExample({
          reconstruction: buildValidReconstruction({ reconstructedAt: '2026-07-15T12:04:00Z' }),
          label: buildValidFinalLabel({ source: buildValidLabelSource({ fetchedAt: '2026-07-15T12:05:00Z' }) }),
        }),
      ],
    } as unknown as Record<string, unknown>);
    const spaceResult = validateMLBHistoricalLabelledDataset(spacePaddedCreatedAt);
    expect(spaceResult.ok).toBe(false);
    if (!spaceResult.ok) {
      expect(spaceResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_TIMESTAMP', path: '$.createdAt' })]),
      );
    }
    if (!spaceResult.ok) {
      const timeOrderIssues = spaceResult.issues.filter((issue) => issue.code === 'INVALID_TIME_ORDER');
      expect(timeOrderIssues).toHaveLength(0);
    }

    const reconAfterCreatedAt = buildValidDataset({
      createdAt: '2026-07-15T12:06:00Z',
      examples: [
        buildValidExample({
          reconstruction: buildValidReconstruction({ reconstructedAt: '2026-07-15T12:07:00Z' }),
        }),
      ],
    });
    const reconResult = validateMLBHistoricalLabelledDataset(reconAfterCreatedAt);
    expect(reconResult.ok).toBe(false);
    if (!reconResult.ok) {
      expect(reconResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.examples[0].reconstruction.reconstructedAt' })]),
      );
    }

    const fetchedAfterCreatedAt = buildValidDataset({
      createdAt: '2026-07-15T12:06:00Z',
      examples: [
        buildValidExample({
          label: buildValidFinalLabel({ source: buildValidLabelSource({ fetchedAt: '2026-07-15T12:07:00Z' }) }),
        }),
      ],
    });
    const fetchedResult = validateMLBHistoricalLabelledDataset(fetchedAfterCreatedAt);
    expect(fetchedResult.ok).toBe(false);
    if (!fetchedResult.ok) {
      expect(fetchedResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.examples[0].label.source.fetchedAt' })]),
      );
    }
  });

  it('validates final-label exact fields and literal values', () => {
    const badLabel = buildValidFinalLabel({ status: 'FINAL' as const });
    const dataset = buildValidDataset({
      examples: [buildValidExample({ label: badLabel })],
    });
    expect(validateMLBHistoricalLabelledDataset(dataset).ok).toBe(false);
  });

  it('enforces label finalization and source-fetch timestamp ordering', () => {
    const badLabel = buildValidFinalLabel({
      finalizedAt: '2026-07-15T11:00:00Z',
      source: buildValidLabelSource({ fetchedAt: '2026-07-15T10:00:00Z' }),
    });
    const dataset = buildValidDataset({
      examples: [buildValidExample({ label: badLabel })],
    });
    const result = validateMLBHistoricalLabelledDataset(dataset);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'INVALID_TIME_ORDER', path: '$.examples[0].label.source.fetchedAt' })]),
      );
    }
  });

  it('enforces team identity, winner identity, score consistency, and no ties', () => {
    const tiedLabel = buildValidFinalLabel({ homeRuns: 4, awayRuns: 4 });
    expect(validateMLBHistoricalLabelledDataset(buildValidDataset({ examples: [buildValidExample({ label: tiedLabel })] })).ok).toBe(false);
    const wrongWinner = buildValidFinalLabel({ homeRuns: 5, awayRuns: 3, winnerTeamId: 'away-1' });
    expect(validateMLBHistoricalLabelledDataset(buildValidDataset({ examples: [buildValidExample({ label: wrongWinner })] })).ok).toBe(false);
  });

  it('requires every example official date to fall within its assigned split', () => {
    const badSnapshot = buildValidSnapshot();
    badSnapshot.game = { ...(badSnapshot.game as Record<string, unknown>), officialDate: '2026-07-20' } as Record<string, unknown>;
    const outOfSplit = buildValidExample({
      split: 'TRAIN' as const,
      snapshot: badSnapshot,
    });
    const dataset = buildValidDataset({ examples: [outOfSplit] });
    const result = validateMLBHistoricalLabelledDataset(dataset);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'EXAMPLE_OUTSIDE_SPLIT', path: '$.examples[0].split' })]),
      );
    }
  });

  it('rejects duplicate example IDs, snapshot IDs, and game IDs', () => {
    const duplicateExamples = buildValidDataset({
      examples: [
        buildValidExample({ exampleId: 'dup' }),
        buildValidExample({ exampleId: 'dup', snapshot: buildValidSnapshot({ snapshotId: 'snapshot-dup', game: { gameId: 'game-dup' } }) }),
      ],
    });
    expect(validateMLBHistoricalLabelledDataset(duplicateExamples).ok).toBe(false);
  });

  it('enforces canonical example ordering without mutating input', () => {
    const unordered = [
      buildValidExample({ exampleId: 'test-1', split: 'TEST' as const, snapshot: buildValidSnapshot({ snapshotId: 'z', game: { gameId: 'z', officialDate: '2026-07-30' } }) }),
      buildValidExample({ exampleId: 'train-1', split: 'TRAIN' as const, snapshot: buildValidSnapshot({ snapshotId: 'a', game: { gameId: 'a', officialDate: '2026-07-01' } }) }),
    ];
    const dataset = buildValidDataset({ examples: unordered });
    const input = dataset as Record<string, unknown>;
    const result = validateMLBHistoricalLabelledDataset(input);
    expect(result.ok).toBe(false);
    expect(input.examples).toHaveLength(2);
  });

  it('validates descriptor-safe objects, null-prototype objects, classes, symbols, and accessors', () => {
    const nullProto = Object.create(null);
    nullProto.contractVersion = MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION;
    nullProto.sport = 'MLB';
    nullProto.target = 'OFFICIAL_FINAL_GAME_WINNER';
    nullProto.datasetId = 'dataset-null';
    nullProto.createdAt = '2026-07-15T12:06:00Z';
    nullProto.splitPolicy = {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
      embargoDays: 0,
      train: { startDate: '2026-07-01', endDate: '2026-07-14' },
      validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
      test: { startDate: '2026-07-22', endDate: '2026-07-31' },
    };
    nullProto.examples = [buildValidExample()];
    const nullProtoResult = validateMLBHistoricalLabelledDataset(nullProto);
    expect(nullProtoResult.ok).toBe(true);
    class FakeDataset {}
    const fake = new FakeDataset();
    (fake as Record<string, unknown>).contractVersion = MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION;
    (fake as Record<string, unknown>).sport = 'MLB';
    (fake as Record<string, unknown>).target = 'OFFICIAL_FINAL_GAME_WINNER';
    (fake as Record<string, unknown>).datasetId = 'dataset-fake';
    (fake as Record<string, unknown>).createdAt = '2026-07-15T12:06:00Z';
    (fake as Record<string, unknown>).splitPolicy = nullProto.splitPolicy;
    (fake as Record<string, unknown>).examples = nullProto.examples;
    expect(validateMLBHistoricalLabelledDataset(fake).ok).toBe(false);
    const symbolObj = buildValidDataset();
    Object.defineProperty(symbolObj, Symbol('hidden'), { value: { sportsbook: 'legacy' }, enumerable: true });
    expect(validateMLBHistoricalLabelledDataset(symbolObj).ok).toBe(false);
  });

  it('validates descriptor-safe examples arrays, sparse arrays, symbols, numeric getters, and numeric setters', () => {
    const sparseArray: unknown[] = [];
    Object.defineProperty(sparseArray, '0', { value: buildValidExample(), enumerable: true });
    Object.defineProperty(sparseArray, '2', { value: buildValidExample({ exampleId: 'ex-2' }), enumerable: true });
    const sparseDataset = buildValidDataset({ examples: sparseArray as unknown as Record<string, unknown> });
    expect(validateMLBHistoricalLabelledDataset(sparseDataset).ok).toBe(false);

    const symbolArray: unknown[] = [];
    const symbol = Symbol('hidden');
    Object.defineProperty(symbolArray, symbol, {
      enumerable: false,
      value: { sportsbook: 'legacy' },
    });
    const symbolDataset = buildValidDataset({ examples: symbolArray as unknown as Record<string, unknown> });
    expect(validateMLBHistoricalLabelledDataset(symbolDataset).ok).toBe(false);

    let numericGetterExecuted = false;
    const accessorArray: unknown[] = [];
    Object.defineProperty(accessorArray, '0', {
      enumerable: true,
      get() {
        numericGetterExecuted = true;
        return buildValidExample();
      },
    });
    const accessorDataset = buildValidDataset({ examples: accessorArray as unknown as Record<string, unknown> });
    expect(validateMLBHistoricalLabelledDataset(accessorDataset).ok).toBe(false);
    expect(numericGetterExecuted).toBe(false);

    let numericSetterExecuted = false;
    const setterArray: unknown[] = [];
    Object.defineProperty(setterArray, '0', {
      set() {
        numericSetterExecuted = true;
      },
      get() {
        return buildValidExample();
      },
    });
    const setterDataset = buildValidDataset({ examples: setterArray as unknown as Record<string, unknown> });
    expect(validateMLBHistoricalLabelledDataset(setterDataset).ok).toBe(false);
    expect(numericSetterExecuted).toBe(false);

    let numericGetExecuted = false;
    let lengthGetExecuted = false;
    let iteratorGetExecuted = false;
    const proposedExamples = new Proxy(
      [buildValidExample()],
      {
        get(target, property, receiver) {
          if (
            typeof property === 'string' &&
            /^(0|[1-9]\d*)$/.test(property)
          ) {
            numericGetExecuted = true;
          }

          if (property === 'length') {
            lengthGetExecuted = true;
          }

          if (property === Symbol.iterator) {
            iteratorGetExecuted = true;
          }

          return Reflect.get(
            target,
            property,
            receiver,
          );
        },
      },
    );
    const proxiedDataset = buildValidDataset({ examples: proposedExamples as unknown as Record<string, unknown> });
    expect(validateMLBHistoricalLabelledDataset(proxiedDataset).ok).toBe(true);
    expect(numericGetExecuted).toBe(false);
    expect(lengthGetExecuted).toBe(false);
    expect(iteratorGetExecuted).toBe(false);

    let descriptorFallbackReturned = false;
    let fallbackGetterExecuted = false;
    const changingDescriptorArray = [buildValidExample()];
    const changingDescriptorProxy = new Proxy(changingDescriptorArray, {
      getOwnPropertyDescriptor(target, prop) {
        if (prop === '0') {
          if (!descriptorFallbackReturned) {
            descriptorFallbackReturned = true;
            return Reflect.getOwnPropertyDescriptor(target, prop);
          }
          return {
            configurable: true,
            enumerable: true,
            get() {
              fallbackGetterExecuted = true;
              return buildValidExample();
            },
          };
        }
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    });
    const changingDescriptorDataset = buildValidDataset({ examples: changingDescriptorProxy as unknown as Record<string, unknown> });
    const changingResult = validateMLBHistoricalLabelledDataset(changingDescriptorDataset);
    expect(changingResult.ok).toBe(false);
    if (!changingResult.ok) {
      const hasInvalidJson = changingResult.issues.some((issue) => issue.code === 'INVALID_JSON_VALUE');
      const hasOddsContamination = changingResult.issues.some((issue) => issue.code === 'ODDS_CONTAMINATION');
      expect(hasInvalidJson || hasOddsContamination).toBe(true);
    }
    expect(fallbackGetterExecuted).toBe(false);

    const emptyArray: unknown[] = [];
    const emptyDataset = buildValidDataset({ examples: emptyArray as unknown as Record<string, unknown> });
    const emptyResult = validateMLBHistoricalLabelledDataset(emptyDataset);
    expect(emptyResult.ok).toBe(false);
    if (!emptyResult.ok) {
      expect(emptyResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_SPLIT_POLICY', path: '$.examples', message: 'Dataset must contain at least one example' }),
        ]),
      );
    }

    const malformedResult = validateMLBHistoricalLabelledDataset(
      buildValidDataset({ examples: [null] as unknown as Record<string, unknown> }),
    );
    expect(malformedResult.ok).toBe(false);
    if (!malformedResult.ok) {
      expect(malformedResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'NOT_PLAIN_OBJECT', path: '$.examples[0]' }),
        ]),
      );
      expect(malformedResult.issues).toEqual(
        expect.not.arrayContaining([
          expect.objectContaining({ code: 'INVALID_SPLIT_POLICY', path: '$.examples', message: 'Dataset must contain at least one example' }),
        ]),
      );
    }

    for (const nonArray of [null, {}, 'not-an-array']) {
      const nonArrayResult = validateMLBHistoricalLabelledDataset(
        buildValidDataset({ examples: nonArray as unknown as Record<string, unknown> }),
      );
      expect(nonArrayResult.ok).toBe(false);
      if (!nonArrayResult.ok) {
        expect(nonArrayResult.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ code: 'NOT_PLAIN_OBJECT', path: '$.examples', message: 'examples must be an array' }),
          ]),
        );
      }
    }

    const nonCanonicalZeroArray: unknown[] = [];
    Object.defineProperty(nonCanonicalZeroArray, '00', { value: buildValidExample(), enumerable: true });
    const nonCanonicalZeroDataset = buildValidDataset({ examples: nonCanonicalZeroArray as unknown as Record<string, unknown> });
    const nonCanonicalZeroResult = validateMLBHistoricalLabelledDataset(nonCanonicalZeroDataset);
    expect(nonCanonicalZeroResult.ok).toBe(false);
    if (!nonCanonicalZeroResult.ok) {
      expect(nonCanonicalZeroResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_JSON_VALUE', path: '$.examples[00]' }),
        ]),
      );
    }

    const nonCanonicalOneArray: unknown[] = [];
    Object.defineProperty(nonCanonicalOneArray, '01', { value: buildValidExample(), enumerable: true });
    const nonCanonicalOneDataset = buildValidDataset({ examples: nonCanonicalOneArray as unknown as Record<string, unknown> });
    const nonCanonicalOneResult = validateMLBHistoricalLabelledDataset(nonCanonicalOneDataset);
    expect(nonCanonicalOneResult.ok).toBe(false);
    if (!nonCanonicalOneResult.ok) {
      expect(nonCanonicalOneResult.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'INVALID_JSON_VALUE', path: '$.examples[01]' }),
        ]),
      );
    }
  });
  it('enforces the outcome-location and point-in-time leakage boundaries', () => {
    const outcomeAtRoot = buildValidDataset({ finalScore: 10 });
    expect(validateMLBHistoricalLabelledDataset(outcomeAtRoot).ok).toBe(false);
    const outcomeAtSplitPolicy = buildValidDataset({
      splitPolicy: { strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const, embargoDays: 0, train: { startDate: '2026-07-01', endDate: '2026-07-14' }, validation: { startDate: '2026-07-16', endDate: '2026-07-20' }, test: { startDate: '2026-07-22', endDate: '2026-07-31' }, finalScore: 10 },
    });
    expect(validateMLBHistoricalLabelledDataset(outcomeAtSplitPolicy).ok).toBe(false);
    const outcomeAtExample = buildValidDataset({
      examples: [buildValidExample({ finalScore: 10 })],
    });
    expect(validateMLBHistoricalLabelledDataset(outcomeAtExample).ok).toBe(false);
    const outcomeAtReconstruction = buildValidDataset({
      examples: [buildValidExample({ reconstruction: buildValidReconstruction({ finalScore: 10 }) })],
    });
    expect(validateMLBHistoricalLabelledDataset(outcomeAtReconstruction).ok).toBe(false);
    const outcomeAtLabelSource = buildValidDataset({
      examples: [buildValidExample({ label: buildValidFinalLabel({ source: buildValidLabelSource({ finalScore: 10 }) }) })],
    });
    expect(validateMLBHistoricalLabelledDataset(outcomeAtLabelSource).ok).toBe(false);
    const outcomeAtSnapshot = buildValidDataset({
      examples: [buildValidExample({ snapshot: buildValidSnapshot({ finalScore: 10 }) })],
    });
    expect(validateMLBHistoricalLabelledDataset(outcomeAtSnapshot).ok).toBe(false);
  });

  it('rejects odds contamination and prohibited prediction/output concepts', () => {
    const oddsKey = buildValidDataset({
      examples: [buildValidExample({ label: buildValidFinalLabel({ source: buildValidLabelSource({ sourceName: 'sportsbook' }) }) })],
    });
    expect(validateMLBHistoricalLabelledDataset(oddsKey).ok).toBe(false);
    const predictionOutput = buildValidDataset({
      examples: [buildValidExample({ snapshot: buildValidSnapshot({ modelProbability: 0.8 }) })],
    });
    expect(validateMLBHistoricalLabelledDataset(predictionOutput).ok).toBe(false);

    const prohibitedArray: unknown[] = [];
    Object.defineProperty(prohibitedArray, 'sportsbook', {
      value: { moneyline: -110 },
      enumerable: true,
      configurable: true,
    });
    const arrayOddsDataset = buildValidDataset({ examples: prohibitedArray as unknown as Record<string, unknown> });
    const arrayOddsResult = validateMLBHistoricalLabelledDataset(arrayOddsDataset);
    expect(arrayOddsResult.ok).toBe(false);
    if (!arrayOddsResult.ok) {
      expect(arrayOddsResult.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'ODDS_CONTAMINATION' })]),
      );
    }
  });

  it('verifies deterministic issue deduplication/order and the static public architecture boundary', async () => {
    const duplicateIssue = buildValidDataset({ datasetId: '' });
    const first = validateMLBHistoricalLabelledDataset(duplicateIssue);
    const second = validateMLBHistoricalLabelledDataset(duplicateIssue);
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    if (!first.ok && !second.ok) {
      expect(first.issues).toEqual(second.issues);
    }

    const orderDataset = buildValidDataset({
      splitPolicy: {
        strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
        embargoDays: 0,
        train: { startDate: '2026-07-01', endDate: '2026-07-14' },
        validation: { startDate: '2026-07-16', endDate: '2026-07-20' },
        test: { startDate: '2026-07-22', endDate: '2026-07-31' },
      },
      examples: [
        buildValidExample({ exampleId: 'a', split: 'TEST' as const, snapshot: buildValidSnapshot({ snapshotId: 'z', game: { gameId: 'z', officialDate: '2026-07-30' } }) }),
        buildValidExample({ exampleId: 'b', split: 'TRAIN' as const, snapshot: buildValidSnapshot({ snapshotId: 'a', game: { gameId: 'a', officialDate: '2026-07-01' } }) }),
        buildValidExample({ exampleId: 'c', split: 'TRAIN' as const, snapshot: buildValidSnapshot({ snapshotId: 'b', game: { gameId: 'b', officialDate: '2026-07-02' } }) }),
      ],
    });
    const orderResult = validateMLBHistoricalLabelledDataset(orderDataset);
    expect(orderResult.ok).toBe(false);
    if (!orderResult.ok) {
      const duplicateKeys = orderResult.issues
        .map((issue) => `${issue.path}\0${issue.code}`)
        .filter((key, index, array) => array.indexOf(key) !== index);
      expect(duplicateKeys).toHaveLength(0);
      const sorted = orderResult.issues
        .slice()
        .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1) || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1));
      expect(orderResult.issues).toEqual(sorted);
    }

    const { readFile } = await import('node:fs/promises');
    const sourcePath = new URL(
      '../../../src/prediction/mlb/mlb-historical-labelled-dataset-contract.ts',
      import.meta.url,
    );
    const sourceCode = await readFile(sourcePath, 'utf8');
    const readExamplesMatch = sourceCode.match(/function readExamplesArray[\s\S]*?\n}\n/);
    expect(readExamplesMatch).toBeTruthy();
    if (readExamplesMatch) {
      const body = readExamplesMatch[0];
      const normalizedBody = body.replace(/\s+/g, ' ');
      expect(normalizedBody).not.toMatch(/value\.length/);
      expect(normalizedBody).not.toMatch(/value\[/);
      expect(normalizedBody).not.toMatch(/Symbol\.iterator/);
      expect(normalizedBody).not.toMatch(/Array\.from\(value\)/);
      expect(normalizedBody).not.toMatch(/value\.map\b/);
      expect(normalizedBody).not.toMatch(/value\.some\b/);
      expect(normalizedBody).not.toMatch(/value\.every\b/);
      expect(normalizedBody).not.toMatch(/value\.slice\b/);
      expect(normalizedBody).not.toMatch(/\.\.\.\s*value/);
      expect(normalizedBody).toMatch(/Object\.getOwnPropertyDescriptor/);
      expect(normalizedBody).toMatch(/descriptor\.value/);
      expect(normalizedBody).toMatch(/\[1\-9\]\\d*/);
      expect((normalizedBody.match(/Reflect\.ownKeys\(value\)/g) || []).length).toBe(1);
      expect(normalizedBody).not.toMatch(/Object\.getOwnPropertySymbols\(value\)/);
      expect(normalizedBody).not.toMatch(/Object\.getOwnPropertyNames\(value\)/);
      expect((normalizedBody.match(/Object\.getOwnPropertyDescriptor\(value,/g) || []).length).toBe(2);
    }
    expect(sourceCode).toMatch(/assertNoOddsContamination\(value\)/);
    expect(sourceCode).not.toMatch(/sanitizedValue/);
    expect(sourceCode).not.toMatch(/validatedExamplesItems/);
    expect(sourceCode).not.toMatch(/Object\.create\(Object\.getPrototypeOf\(value\)\)/);
    const exportMatches = sourceCode.matchAll(/\bexport\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g);
    const actualExports = Array.from(exportMatches, (m) => m[1]);
    const expectedExports = [
      'MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION',
      'MLBHistoricalDatasetSplit',
      'MLBHistoricalSplitStrategy',
      'MLBHistoricalReconstructionMode',
      'MLBHistoricalFinalLabelStatus',
      'MLBHistoricalSplitWindow',
      'MLBHistoricalSplitPolicy',
      'MLBHistoricalReconstructionMetadata',
      'MLBHistoricalFinalLabelSource',
      'MLBHistoricalFinalLabel',
      'MLBHistoricalDatasetExample',
      'MLBHistoricalLabelledDataset',
      'MLBHistoricalDatasetValidationIssue',
      'validateMLBHistoricalLabelledDataset',
    ];
    expect(actualExports).toEqual(expectedExports);
  });
});
