import { describe, expect, it } from 'vitest';
import {
  buildMLBRealHistoricalTrainingMatrixV1,
} from '@/prediction/mlb/mlb-real-historical-training-matrix-v1';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  extractMLBRealPregameWinnerFeatureVectorV1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-vector-v1';
import {
  buildMLBLeakageSafeTrainingMatrix,
  validateMLBTrainingMatrix,
  MLB_TRAINING_MATRIX_CONTRACT_VERSION,
  MLB_TRAINING_TARGET_ENCODING,
} from '@/prediction/mlb/mlb-training-matrix-contract';
import {
  MLB_HISTORICAL_LABELLED_DATASET_CONTRACT_VERSION,
  validateMLBHistoricalLabelledDataset,
} from '@/prediction/mlb/mlb-historical-labelled-dataset-contract';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00.000Z';

function buildGame(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    gameId: 'game-1',
    scheduledStartAt: FROZEN_SCHEDULED_START,
    officialDate: '2026-07-15',
    season: 2026,
    gameType: 'REGULAR_SEASON',
    status: 'SCHEDULED',
    homeTeamId: '110',
    awayTeamId: '111',
    venueId: 'venue-1',
    neutralSite: null,
    doubleheader: null,
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidSnapshot(
  overrides: Record<string, unknown> = {},
  gameOverrides: Record<string, unknown> = {},
): MLBCanonicalPregameSnapshot {
  const base: MLBCanonicalPregameSnapshot = {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-1',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: '2026-07-15',
      season: 2026,
      gameType: 'REGULAR_SEASON',
      status: 'SCHEDULED',
      homeTeamId: '110',
      awayTeamId: '111',
      venueId: 'venue-1',
      neutralSite: null,
      doubleheader: null,
      ...gameOverrides,
    },
    sourceReferences: [
      {
        sourceRefId: 'src-official',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['GAME_IDENTITY'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: null,
      },
    ],
    sections: [
      {
        sectionId: 'section-away-batting',
        kind: 'TEAM_SEASON_CONTEXT',
        entity: { scope: 'AWAY_TEAM', entityId: '111' },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {
          seasonStats: {
            winRate: 0.5,
            runsScoredPerGame: 4.2,
            runsAllowedPerGame: 3.8,
          },
        },
      },
      {
        sectionId: 'section-away-bullpen',
        kind: 'BULLPEN_CONTEXT',
        entity: { scope: 'AWAY_TEAM', entityId: '111' },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {
          recentWorkload: {
            extraInningGames: 3,
            gamesInPrevious3Days: 1,
          },
        },
      },
      {
        sectionId: 'section-away-starter',
        kind: 'STARTING_PITCHER_CONTEXT',
        entity: { scope: 'AWAY_STARTER', entityId: 'p-2' },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {},
      },
      {
        sectionId: 'section-game-context',
        kind: 'GAME_CONTEXT',
        entity: { scope: 'GAME', entityId: null },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {
          officialDate: '2026-07-15',
          scheduledStartAt: '2026-07-15T12:00:00.000Z',
          status: 'SCHEDULED',
          homeTeamName: 'New York Yankees',
          awayTeamName: 'Boston Red Sox',
          dayNight: 'day',
          scheduledInnings: 9,
          seriesDescription: 'Regular Season',
          doubleHeader: 'N',
        },
      },
      {
        sectionId: 'section-home-batting',
        kind: 'TEAM_SEASON_CONTEXT',
        entity: { scope: 'HOME_TEAM', entityId: '110' },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {
          seasonStats: {
            winRate: 0.6,
            runsScoredPerGame: 4.5,
            runsAllowedPerGame: 3.5,
          },
        },
      },
      {
        sectionId: 'section-home-bullpen',
        kind: 'BULLPEN_CONTEXT',
        entity: { scope: 'HOME_TEAM', entityId: '110' },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {
          recentWorkload: {
            extraInningGames: 2,
            gamesInPrevious3Days: 0,
          },
        },
      },
      {
        sectionId: 'section-home-starter',
        kind: 'STARTING_PITCHER_CONTEXT',
        entity: { scope: 'HOME_STARTER', entityId: 'p-1' },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {},
      },
    ],
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'p-1',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'p-2',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
      },
    },
    dataCompleteness: 'COMPLETE',
    warnings: [],
    ...overrides,
  };
  return base;
}

function buildValidLabelSource(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    sourceName: 'Official MLB',
    sourceRecordId: 'rec-1',
    fetchedAt: '2026-07-15T12:05:00Z',
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidFinalLabel(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    status: 'OFFICIAL_FINAL' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    homeRuns: 5,
    awayRuns: 3,
    winnerTeamId: '110',
    finalizedAt: '2026-07-15T12:05:00Z',
    source: buildValidLabelSource(),
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidExample(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    exampleId: 'example-1',
    split: 'TRAIN' as const,
    snapshot: buildValidSnapshot(),
    reconstruction: {
      mode: 'POINT_IN_TIME_AS_OF_CUTOFF' as const,
      cutoffAt: FROZEN_DATA_CUTOFF,
      reconstructedAt: '2026-07-15T12:04:00Z',
    },
    label: buildValidFinalLabel(),
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidDataset(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const trainSnapshot = buildValidSnapshot({
    snapshotId: 'snapshot-train',
    game: buildGame({ gameId: 'game-train', officialDate: '2026-07-10' }),
  });
  const validationSnapshot = buildValidSnapshot({
    snapshotId: 'snapshot-val',
    game: buildGame({ gameId: 'game-val', officialDate: '2026-07-18' }),
  });
  const testSnapshot = buildValidSnapshot({
    snapshotId: 'snapshot-test',
    game: buildGame({ gameId: 'game-test', officialDate: '2026-07-25' }),
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

describe('mlb-real-historical-training-matrix-v1', () => {
  it('deep-equals the existing matrix builder bound to the locked real V1 manifest', () => {
    const dataset = buildValidDataset();
    const wrapperResult = buildMLBRealHistoricalTrainingMatrixV1(dataset);
    const directResult = buildMLBLeakageSafeTrainingMatrix(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      dataset,
    );

    expect(wrapperResult).toEqual(directResult);
  });

  it('produces matrix rows whose vectors equal the B2 real V1 extraction', () => {
    const dataset = buildValidDataset();
    const datasetResult = validateMLBHistoricalLabelledDataset(dataset);
    expect(datasetResult.ok).toBe(true);
    if (!datasetResult.ok) return;

    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (let i = 0; i < result.value.rows.length; i++) {
      const extracted = extractMLBRealPregameWinnerFeatureVectorV1(
        datasetResult.value.examples[i].snapshot,
      );
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) return;
      expect(result.value.rows[i].vector.values).toEqual(extracted.value.values);
    }
  });

  it('validates the constructed matrix with the existing training matrix validator', () => {
    const dataset = buildValidDataset();
    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const validationResult = validateMLBTrainingMatrix(result.value);
    expect(validationResult.ok).toBe(true);
    if (!validationResult.ok) return;
    expect(validationResult.value.rows).toHaveLength(3);
  });

  it('preserves row count from the input dataset', () => {
    const dataset = buildValidDataset();
    const datasetResult = validateMLBHistoricalLabelledDataset(dataset);
    expect(datasetResult.ok).toBe(true);
    if (!datasetResult.ok) return;

    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rows).toHaveLength(datasetResult.value.examples.length);
    expect(result.value.splitCounts.train).toBe(1);
    expect(result.value.splitCounts.validation).toBe(1);
    expect(result.value.splitCounts.test).toBe(1);
  });

  it('preserves exact split assignments and split policy metadata', () => {
    const dataset = buildValidDataset({
      splitPolicy: {
        strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
        embargoDays: 2,
        train: { startDate: '2026-07-01', endDate: '2026-07-14' },
        validation: { startDate: '2026-07-17', endDate: '2026-07-20' },
        test: { startDate: '2026-07-23', endDate: '2026-07-31' },
      },
    });
    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rows[0].split).toBe('TRAIN');
    expect(result.value.rows[1].split).toBe('VALIDATION');
    expect(result.value.rows[2].split).toBe('TEST');
    expect(result.value.splitPolicy.embargoDays).toBe(2);
    expect(result.value.splitPolicy.train.endDate).toBe('2026-07-14');
    expect(result.value.splitPolicy.validation.startDate).toBe('2026-07-17');
    expect(result.value.splitPolicy.test.startDate).toBe('2026-07-23');
  });

  it('encodes a home winner as target 1', () => {
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'home-win',
          split: 'TRAIN',
          snapshot: buildValidSnapshot({
            snapshotId: 'snapshot-hw',
            game: buildGame({ gameId: 'game-hw', officialDate: '2026-07-10' }),
          }),
          label: buildValidFinalLabel({ winnerTeamId: '110', homeRuns: 5, awayRuns: 3 }),
        }),
      ],
    });
    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rows).toHaveLength(1);
    expect(result.value.rows[0].targetValue).toBe(1);
  });

  it('encodes an away winner as target 0', () => {
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'away-win',
          split: 'TRAIN',
          snapshot: buildValidSnapshot({
            snapshotId: 'snapshot-aw',
            game: buildGame({ gameId: 'game-aw', officialDate: '2026-07-10' }),
          }),
          label: buildValidFinalLabel({ winnerTeamId: '111', homeRuns: 2, awayRuns: 4 }),
        }),
      ],
    });
    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.rows).toHaveLength(1);
    expect(result.value.rows[0].targetValue).toBe(0);
  });

  it('constructs the same matrix deterministically on repeated calls', () => {
    const dataset = buildValidDataset();
    const first = buildMLBRealHistoricalTrainingMatrixV1(dataset);
    const second = buildMLBRealHistoricalTrainingMatrixV1(dataset);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.value.rows).toHaveLength(second.value.rows.length);
    for (let i = 0; i < first.value.rows.length; i++) {
      expect(first.value.rows[i]).toEqual(second.value.rows[i]);
    }
    expect(first.value.splitCounts).toEqual(second.value.splitCounts);
    expect(first.value.matrixId).toBe(second.value.matrixId);
  });

  it('does not mutate the input dataset or nested examples', () => {
    const dataset = buildValidDataset();
    const datasetClone = structuredClone(dataset);

    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);
    expect(result.ok).toBe(true);

    expect(dataset).toEqual(datasetClone);
  });

  it('returns a fail-closed result when feature extraction fails for an example', () => {
    const invalidSnapshot = buildValidSnapshot(
      { sections: [
        {
          sectionId: 'section-away-batting',
          kind: 'TEAM_SEASON_CONTEXT',
          entity: { scope: 'AWAY_TEAM', entityId: '111' },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: {
            seasonStats: {
              winRate: 'fifty',
              runsScoredPerGame: 4.2,
              runsAllowedPerGame: 3.8,
            },
          },
        },
        {
          sectionId: 'section-away-bullpen',
          kind: 'BULLPEN_CONTEXT',
          entity: { scope: 'AWAY_TEAM', entityId: '111' },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: {
            recentWorkload: {
              extraInningGames: 3,
              gamesInPrevious3Days: 1,
            },
          },
        },
        {
          sectionId: 'section-away-starter',
          kind: 'STARTING_PITCHER_CONTEXT',
          entity: { scope: 'AWAY_STARTER', entityId: 'p-2' },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: {},
        },
        {
          sectionId: 'section-game-context',
          kind: 'GAME_CONTEXT',
          entity: { scope: 'GAME', entityId: null },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: {
            officialDate: '2026-07-10',
            scheduledStartAt: '2026-07-15T12:00:00.000Z',
            status: 'SCHEDULED',
            homeTeamName: 'New York Yankees',
            awayTeamName: 'Boston Red Sox',
            dayNight: 'day',
            scheduledInnings: 9,
            seriesDescription: 'Regular Season',
            doubleHeader: 'N',
          },
        },
        {
          sectionId: 'section-home-batting',
          kind: 'TEAM_SEASON_CONTEXT',
          entity: { scope: 'HOME_TEAM', entityId: '110' },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: {
            seasonStats: {
              winRate: 0.6,
              runsScoredPerGame: 4.5,
              runsAllowedPerGame: 3.5,
            },
          },
        },
        {
          sectionId: 'section-home-bullpen',
          kind: 'BULLPEN_CONTEXT',
          entity: { scope: 'HOME_TEAM', entityId: '110' },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: {
            recentWorkload: {
              extraInningGames: 2,
              gamesInPrevious3Days: 0,
            },
          },
        },
        {
          sectionId: 'section-home-starter',
          kind: 'STARTING_PITCHER_CONTEXT',
          entity: { scope: 'HOME_STARTER', entityId: 'p-1' },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: {},
        },
      ] },
      { officialDate: '2026-07-10' },
    );
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'invalid',
          split: 'TRAIN',
          snapshot: invalidSnapshot,
        }),
      ],
    });

    const datasetValidation = validateMLBHistoricalLabelledDataset(dataset);
    expect(datasetValidation.ok).toBe(true);
    if (!datasetValidation.ok) return;

    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'FEATURE_EXTRACTION_FAILED' }),
      ]),
    );
  });

  it('rejects an invalid historical dataset upstream rather than silently building a partial matrix', () => {
    const invalidDataset = buildValidDataset({
      examples: [],
    });

    const datasetValidation = validateMLBHistoricalLabelledDataset(invalidDataset);
    expect(datasetValidation.ok).toBe(false);

    const result = buildMLBRealHistoricalTrainingMatrixV1(invalidDataset);
    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'DATASET_INVALID' }),
      ]),
    );
  });

  it('uses the exact locked real V1 manifest identity on the produced matrix', () => {
    const dataset = buildValidDataset();
    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.manifestId).toBe(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId);
    expect(result.value.matrixId).toBe(`${dataset.datasetId}::${MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId}`);
  });

  it('does not perform any preprocessing fit or feature transformation', () => {
    const dataset = buildValidDataset();
    const datasetResult = validateMLBHistoricalLabelledDataset(dataset);
    expect(datasetResult.ok).toBe(true);
    if (!datasetResult.ok) return;

    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const sourceVector = extractMLBRealPregameWinnerFeatureVectorV1(
      datasetResult.value.examples[0].snapshot,
    );
    expect(sourceVector.ok).toBe(true);
    if (!sourceVector.ok) return;

    expect(result.value.rows[0].vector.values).toEqual(sourceVector.value.values);
  });

  it('rejects datasets with prohibited odds fields via the existing odds contamination guard', () => {
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'odds-example',
          split: 'TRAIN',
          snapshot: buildValidSnapshot({
            snapshotId: 'snapshot-odds',
            game: buildGame({ gameId: 'game-odds', officialDate: '2026-07-10' }),
          }),
          label: buildValidFinalLabel({
            source: {
              sourceName: 'Official MLB',
              sourceRecordId: 'rec-odds',
              fetchedAt: '2026-07-15T12:05:00Z',
              sportsbookOdds: 1.5,
            } as Record<string, unknown>,
          }),
        }),
      ],
    });

    const datasetValidation = validateMLBHistoricalLabelledDataset(dataset);
    expect(datasetValidation.ok).toBe(false);
  });

  it('does not introduce any numeric game or snapshot identifiers as features', () => {
    const dataset = buildValidDataset();
    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    for (const row of result.value.rows) {
      for (const value of row.vector.values) {
        expect(typeof value.value).not.toBe('string');
      }
    }
  });

  it('returns an invalid target encoding issue when the existing matrix validator rejects the constructed matrix', () => {
    const dataset = buildValidDataset();
    const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const validationResult = validateMLBTrainingMatrix(result.value);
    expect(validationResult.ok).toBe(true);
  });
});
