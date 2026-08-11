import { describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseMLBRealHistoricalTrainingMatrixCliArgs } from '../../../scripts/materialize-mlb-real-historical-training-matrix-v1';
import {
  buildMLBRealHistoricalTrainingMatrixV1,
} from '@/prediction/mlb/mlb-real-historical-training-matrix-v1';
import {
  buildMLBLeakageSafeTrainingMatrix,
  validateMLBTrainingMatrix,
  MLB_TRAINING_MATRIX_CONTRACT_VERSION,
  MLB_TRAINING_TARGET_ENCODING,
} from '@/prediction/mlb/mlb-training-matrix-contract';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  extractMLBRealPregameWinnerFeatureVectorV1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-vector-v1';
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

function materializeViaDirectBuilder(
  dataset: unknown,
): { ok: boolean; data?: unknown; issues?: Array<{ code: string; message: string }> } {
  const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);
  if (result.ok) {
    return { ok: true, data: result.value };
  }
  return {
    ok: false,
    issues: result.issues.map((issue) => ({ code: issue.code, message: issue.message })),
  };
}

async function writeTempJson(
  fileName: string,
  data: unknown,
): Promise<string> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mre-phase8v-d3-b4-'));
  const filePath = path.join(tempDir, fileName);
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return filePath;
}

async function removeTempPath(targetPath: string): Promise<void> {
  const tempDir = path.dirname(targetPath);
  await fs.rm(targetPath, { force: true });
  await fs.rmdir(tempDir).catch(() => {});
}

async function runMaterializeCli(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  const originalArgv = process.argv;
  try {
    process.argv = ['node', 'script.ts', '--input', inputPath, '--output', outputPath];
    const materialize = await import('../../../scripts/materialize-mlb-real-historical-training-matrix-v1');
    await materialize.main();
  } finally {
    process.argv = originalArgv;
  }
}

describe('mlb-real-historical-training-matrix-materialization-v1', () => {
  it('parses CLI arguments with --input and --output', () => {
    const args = parseMLBRealHistoricalTrainingMatrixCliArgs([
      'node',
      'script.ts',
      '--input',
      'in.json',
      '--output',
      'out.json',
    ]);

    expect(args.input).toBe('in.json');
    expect(args.output).toBe('out.json');
  });

  it('rejects missing --input', () => {
    expect(() =>
      parseMLBRealHistoricalTrainingMatrixCliArgs([
        'node',
        'script.ts',
        '--output',
        'out.json',
      ]),
    ).toThrow('Missing --input');
  });

  it('rejects missing --output', () => {
    expect(() =>
      parseMLBRealHistoricalTrainingMatrixCliArgs([
        'node',
        'script.ts',
        '--input',
        'in.json',
      ]),
    ).toThrow('Missing --output');
  });

  it('materializes a valid training matrix JSON from a valid dataset', async () => {
    const dataset = buildValidDataset();
    const inputPath = await writeTempJson('dataset.json', dataset);
    const outputPath = path.join(path.dirname(inputPath), 'matrix.json');

    try {
      await runMaterializeCli(inputPath, outputPath);

      const raw = await fs.readFile(outputPath, 'utf8');
      const parsed = JSON.parse(raw);
      const validation = validateMLBTrainingMatrix(parsed);
      expect(validation.ok).toBe(true);
      if (validation.ok) {
        expect(validation.value.contractVersion).toBe(MLB_TRAINING_MATRIX_CONTRACT_VERSION);
        expect(validation.value.manifestId).toBe(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId);
        expect(validation.value.rows).toHaveLength(3);
        expect(validation.value.splitCounts.train).toBe(1);
        expect(validation.value.splitCounts.validation).toBe(1);
        expect(validation.value.splitCounts.test).toBe(1);
      }
    } finally {
      await removeTempPath(inputPath);
      await removeTempPath(outputPath);
    }
  });

  it('produces byte-identical output for the same input on repeated materializations', async () => {
    const dataset = buildValidDataset();
    const inputPath = await writeTempJson('dataset.json', dataset);
    const outputPathA = path.join(path.dirname(inputPath), 'matrix-a.json');
    const outputPathB = path.join(path.dirname(inputPath), 'matrix-b.json');

    try {
      await runMaterializeCli(inputPath, outputPathA);
      await runMaterializeCli(inputPath, outputPathB);

      const contentA = await fs.readFile(outputPathA, 'utf8');
      const contentB = await fs.readFile(outputPathB, 'utf8');
      expect(contentA).toBe(contentB);
    } finally {
      await removeTempPath(inputPath);
      await removeTempPath(outputPathA);
      await removeTempPath(outputPathB);
    }
  });

  it('fails closed on invalid JSON input', async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mre-phase8v-d3-b4-'));
    const inputPath = path.join(tempDir, 'invalid.json');
    const outputPath = path.join(tempDir, 'matrix.json');
    await fs.writeFile(inputPath, 'not-json', 'utf8');

    try {
      let threw = false;
      try {
        await runMaterializeCli(inputPath, outputPath);
      } catch {
        threw = true;
      }

      expect(threw).toBe(true);
      const exists = await fs.stat(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    } finally {
      await removeTempPath(inputPath);
      await removeTempPath(outputPath);
    }
  });

  it('fails closed on a domain-invalid historical dataset', async () => {
    const invalidDataset = buildValidDataset({ examples: [] });
    const inputPath = await writeTempJson('dataset.json', invalidDataset);
    const outputPath = path.join(path.dirname(inputPath), 'matrix.json');

    try {
      let threw = false;
      try {
        await runMaterializeCli(inputPath, outputPath);
      } catch {
        threw = true;
      }

      expect(threw).toBe(true);
      const exists = await fs.stat(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    } finally {
      await removeTempPath(inputPath);
      await removeTempPath(outputPath);
    }
  });

  it('does not write an output file when the underlying matrix builder returns issues', async () => {
    const invalidSnapshot = buildValidSnapshot({
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
      ],
    }, { officialDate: '2026-07-10' });
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'invalid',
          split: 'TRAIN',
          snapshot: invalidSnapshot,
        }),
      ],
    });
    const inputPath = await writeTempJson('dataset.json', dataset);
    const outputPath = path.join(path.dirname(inputPath), 'matrix.json');

    try {
      let threw = false;
      try {
        await runMaterializeCli(inputPath, outputPath);
      } catch {
        threw = true;
      }

      expect(threw).toBe(true);
      const exists = await fs.stat(outputPath).then(() => true).catch(() => false);
      expect(exists).toBe(false);
    } finally {
      await removeTempPath(inputPath);
      await removeTempPath(outputPath);
    }
  });

  it('imports without side effects', async () => {
    const module = await import('../../../scripts/materialize-mlb-real-historical-training-matrix-v1');

    expect(typeof module.parseMLBRealHistoricalTrainingMatrixCliArgs).toBe('function');
    expect(typeof module.main).toBe('function');
  });

  it('delegates to the existing matrix builder and binds the locked manifest', () => {
    const dataset = buildValidDataset();
    const directResult = buildMLBLeakageSafeTrainingMatrix(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      dataset,
    );
    const wrapperResult = buildMLBRealHistoricalTrainingMatrixV1(dataset);

    expect(wrapperResult).toEqual(directResult);
    if (wrapperResult.ok && directResult.ok) {
      expect(wrapperResult.value.manifestId).toBe(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId);
      expect(wrapperResult.value.matrixId).toBe(`${dataset.datasetId}::${MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId}`);
    }
  });

  it('preserves example count and split counts in the materialized matrix', async () => {
    const dataset = buildValidDataset();
    const datasetResult = validateMLBHistoricalLabelledDataset(dataset);
    expect(datasetResult.ok).toBe(true);
    if (!datasetResult.ok) return;

    const { data } = materializeViaDirectBuilder(dataset);
    if (!data) return;

    const validation = validateMLBTrainingMatrix(data as any);
    expect(validation.ok).toBe(true);
    if (!validation.ok) return;

    expect(validation.value.rows).toHaveLength(datasetResult.value.examples.length);
    expect(validation.value.splitCounts.train).toBe(1);
    expect(validation.value.splitCounts.validation).toBe(1);
    expect(validation.value.splitCounts.test).toBe(1);
  });

  it('produces 14-feature V1 vectors identical to B2 extraction', () => {
    const dataset = buildValidDataset();
    const datasetResult = validateMLBHistoricalLabelledDataset(dataset);
    expect(datasetResult.ok).toBe(true);
    if (!datasetResult.ok) return;

    const { data } = materializeViaDirectBuilder(dataset);
    if (!data) return;

    const matrix = data as any;
    for (let i = 0; i < matrix.rows.length; i++) {
      const extracted = extractMLBRealPregameWinnerFeatureVectorV1(
        datasetResult.value.examples[i].snapshot,
      );
      expect(extracted.ok).toBe(true);
      if (!extracted.ok) return;
      expect(matrix.rows[i].vector.values).toEqual(extracted.value.values);
    }
  });

  it('encodes targets only from labels and never from outcome or postgame fields', () => {
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

    const { data } = materializeViaDirectBuilder(dataset);
    if (!data) return;

    const matrix = data as any;
    expect(matrix.rows[0].targetValue).toBe(1);
    expect(matrix.rows[1].targetValue).toBe(0);
    for (const row of matrix.rows) {
      for (const value of row.vector.values) {
        expect(typeof value.value).not.toBe('string');
      }
    }
  });

  it('reports exact missingness without transforming it', () => {
    const missingStarterSnapshot = buildValidSnapshot({
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
          payload: null,
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
          payload: null,
        },
      ],
    });
    const dataset = buildValidDataset({
      examples: [
        buildValidExample({
          exampleId: 'missing-starters',
          split: 'TRAIN',
          snapshot: missingStarterSnapshot,
        }),
      ],
    });

    const { data } = materializeViaDirectBuilder(dataset);
    if (!data) return;

    const matrix = data as any;
    expect(matrix.rows).toHaveLength(1);
    const featureValues = matrix.rows[0].vector.values;
    const awayIndex = featureValues.findIndex((item: any) => item.featureId === 'awayStarterAvailable');
    const homeIndex = featureValues.findIndex((item: any) => item.featureId === 'homeStarterAvailable');
    expect(awayIndex >= 0).toBe(true);
    expect(homeIndex >= 0).toBe(true);
    expect(featureValues[awayIndex].wasMissing).toBe(true);
    expect(featureValues[homeIndex].wasMissing).toBe(true);
    expect(featureValues[awayIndex].value).toBe(0);
    expect(featureValues[homeIndex].value).toBe(0);
  });
});
