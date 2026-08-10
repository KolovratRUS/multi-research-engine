import { describe, expect, it } from 'vitest';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  extractMLBLeakageSafeFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  extractMLBRealPregameWinnerFeatureVectorV1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-vector-v1';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
  type MLBPregameSnapshotSection,
  type MLBPregameSnapshotWarning,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00.000Z';

function buildSourceReference(
  overrides: Record<string, unknown> = {},
): MLBCanonicalPregameSnapshot['sourceReferences'][number] {
  return {
    sourceRefId: 'src-official',
    sourceName: 'MLB Stats API',
    sourceCategory: 'OFFICIAL',
    roles: ['GAME_IDENTITY'],
    providerRecordId: null,
    fetchedAt: FROZEN_CAPTURED_AT,
    sourceUpdatedAt: null,
    ...overrides,
  };
}

function buildSection(
  overrides: Record<string, unknown> = {},
): MLBPregameSnapshotSection {
  return {
    sectionId: 'sec-1',
    kind: 'GAME_CONTEXT',
    entity: { scope: 'GAME', entityId: null },
    status: 'AVAILABLE',
    asOfAt: FROZEN_DATA_CUTOFF,
    sourceRefIds: ['src-official'],
    payload: {},
    ...overrides,
  } as MLBPregameSnapshotSection;
}

function buildWarning(
  overrides: Record<string, unknown> = {},
): MLBPregameSnapshotWarning {
  return {
    code: 'PATCHY_WIND',
    path: '$.venue.wind',
    message: 'Wind speed varies across reported sources.',
    ...overrides,
  };
}

function buildGameContextSection(
  overrides: Record<string, unknown> = {},
): MLBPregameSnapshotSection {
  return buildSection({
    sectionId: 'section-game-context',
    kind: 'GAME_CONTEXT',
    entity: { scope: 'GAME', entityId: null },
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
      ...overrides,
    },
  });
}

function buildBattingSection(
  side: 'home' | 'away',
  overrides: Record<string, unknown> = {},
): MLBPregameSnapshotSection {
  return buildSection({
    sectionId: `section-${side}-batting`,
    kind: 'TEAM_SEASON_CONTEXT',
    entity: { scope: side === 'home' ? 'HOME_TEAM' : 'AWAY_TEAM', entityId: side === 'home' ? '110' : '111' },
    payload: {
      seasonStats: {
        winRate: 0.5,
        runsScoredPerGame: 4.2,
        runsAllowedPerGame: 3.8,
      },
      ...overrides,
    },
  });
}

function buildBullpenSection(
  side: 'home' | 'away',
  overrides: Record<string, unknown> = {},
): MLBPregameSnapshotSection {
  return buildSection({
    sectionId: `section-${side}-bullpen`,
    kind: 'BULLPEN_CONTEXT',
    entity: { scope: side === 'home' ? 'HOME_TEAM' : 'AWAY_TEAM', entityId: side === 'home' ? '110' : '111' },
    payload: {
      recentWorkload: {
        extraInningGames: 3,
        gamesInPrevious3Days: 1,
      },
      ...overrides,
    },
  });
}

function buildStarterSection(
  side: 'home' | 'away',
  overrides: Record<string, unknown> = {},
): MLBPregameSnapshotSection {
  return buildSection({
    sectionId: `section-${side}-starter`,
    kind: 'STARTING_PITCHER_CONTEXT',
    entity: { scope: side === 'home' ? 'HOME_STARTER' : 'AWAY_STARTER', entityId: side === 'home' ? 'p-1' : 'p-2' },
    payload: { ...overrides },
  });
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
    sourceReferences: [buildSourceReference()],
    sections: [
      buildBattingSection('away'),
      buildBullpenSection('away'),
      buildStarterSection('away'),
      buildGameContextSection(),
      buildBattingSection('home'),
      buildBullpenSection('home'),
      buildStarterSection('home'),
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
    warnings: [buildWarning()],
  };

  return { ...base, ...overrides } as MLBCanonicalPregameSnapshot;
}

describe('mlb-real-pregame-winner-feature-vector-v1', () => {
  it('produces exactly 14 features in manifest order for a valid snapshot', () => {
    const snapshot = buildValidSnapshot();
    const result = extractMLBRealPregameWinnerFeatureVectorV1(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const expectedIds = [
      'awayBullpenExtraInningGames',
      'awayBullpenGamesInPrevious3Days',
      'awayRunsAllowedPerGame',
      'awayRunsScoredPerGame',
      'awayStarterAvailable',
      'awayWinRate',
      'doubleHeaderGameNumber',
      'homeBullpenExtraInningGames',
      'homeBullpenGamesInPrevious3Days',
      'homeRunsAllowedPerGame',
      'homeRunsScoredPerGame',
      'homeStarterAvailable',
      'homeWinRate',
      'scheduledInnings',
    ];

    expect(result.value.values).toHaveLength(14);
    expect(result.value.values.map((v) => v.featureId)).toEqual(expectedIds);
    expect(result.value.manifestId).toBe('mlb-real-pregame-winner-feature-manifest-v1');
    expect(result.value.snapshotId).toBe('snapshot-1');
    expect(result.value.gameId).toBe('game-1');
    expect(result.value.officialDate).toBe('2026-07-15');
    expect(result.value.dataCutoffAt).toBe(FROZEN_DATA_CUTOFF);
  });

  it('deep-equals the direct shared-extractor call for the same snapshot', () => {
    const snapshot = buildValidSnapshot();
    const wrapperResult = extractMLBRealPregameWinnerFeatureVectorV1(snapshot);
    const directResult = extractMLBLeakageSafeFeatureVector(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      snapshot,
    );

    expect(wrapperResult).toEqual(directResult);
  });

  it('produces deterministic output on repeated extraction of the same snapshot', () => {
    const snapshot = buildValidSnapshot();
    const first = extractMLBRealPregameWinnerFeatureVectorV1(snapshot);
    const second = extractMLBRealPregameWinnerFeatureVectorV1(snapshot);

    expect(first).toEqual(second);
    if (first.ok && second.ok) {
      expect(first.value.values).toEqual(second.value.values);
    }
  });

  it('does not mutate the input snapshot', () => {
    const snapshot = buildValidSnapshot();
    const before = JSON.parse(JSON.stringify(snapshot));
    extractMLBRealPregameWinnerFeatureVectorV1(snapshot);
    const after = JSON.parse(JSON.stringify(snapshot));

    expect(after).toEqual(before);
  });

  it('extracts doubleHeaderGameNumber = 2 with wasMissing = false for a doubleheader', () => {
    const snapshot = buildValidSnapshot(
      { sections: [buildGameContextSection({ doubleHeaderGameNumber: 2 })] },
      { doubleheader: { doubleheaderId: '10:2026-07-153:1103:111', gameNumber: 2 } },
    );
    const result = extractMLBRealPregameWinnerFeatureVectorV1(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = result.value.values.find((v) => v.featureId === 'doubleHeaderGameNumber');
    expect(entry).toBeDefined();
    expect(entry?.value).toBe(2);
    expect(entry?.wasMissing).toBe(false);
  });

  it('extracts doubleHeaderGameNumber = 0 with wasMissing = true when payload is absent', () => {
    const snapshot = buildValidSnapshot(
      { sections: [buildGameContextSection()] },
      { doubleheader: null },
    );
    const result = extractMLBRealPregameWinnerFeatureVectorV1(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const entry = result.value.values.find((v) => v.featureId === 'doubleHeaderGameNumber');
    expect(entry).toBeDefined();
    expect(entry?.value).toBe(0);
    expect(entry?.wasMissing).toBe(true);
  });

  it('extracts starter availability with numeric model value when available', () => {
    const snapshot = buildValidSnapshot({
      sections: [
        buildBattingSection('away'),
        buildBullpenSection('away'),
        buildStarterSection('away', { availability: 1 }),
        buildGameContextSection(),
        buildBattingSection('home'),
        buildBullpenSection('home'),
        buildStarterSection('home', { availability: 1 }),
      ],
    });
    const result = extractMLBRealPregameWinnerFeatureVectorV1(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const home = result.value.values.find((v) => v.featureId === 'homeStarterAvailable');
    const away = result.value.values.find((v) => v.featureId === 'awayStarterAvailable');
    expect(home?.value).toBe(1);
    expect(home?.wasMissing).toBe(false);
    expect(away?.value).toBe(1);
    expect(away?.wasMissing).toBe(false);
  });

  it('extracts starter availability default with wasMissing = true when payload is absent', () => {
    const snapshot = buildValidSnapshot({
      sections: [
        buildBattingSection('away'),
        buildBullpenSection('away'),
        buildStarterSection('away'),
        buildGameContextSection(),
        buildBattingSection('home'),
        buildBullpenSection('home'),
        buildStarterSection('home'),
      ],
    });
    const result = extractMLBRealPregameWinnerFeatureVectorV1(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const home = result.value.values.find((v) => v.featureId === 'homeStarterAvailable');
    const away = result.value.values.find((v) => v.featureId === 'awayStarterAvailable');
    expect(home?.value).toBe(0);
    expect(home?.wasMissing).toBe(true);
    expect(away?.value).toBe(0);
    expect(away?.wasMissing).toBe(true);
  });

  it('extracts numeric team stats when present and defaults when absent', () => {
    const snapshot = buildValidSnapshot({
      sections: [
        buildBattingSection('away'),
        buildBullpenSection('away'),
        buildStarterSection('away'),
        buildGameContextSection(),
        buildBattingSection('home', {
          seasonStats: { winRate: 0.6, runsScoredPerGame: 5.1, runsAllowedPerGame: 3.2 },
        }),
        buildBullpenSection('home'),
        buildStarterSection('home'),
      ],
    });
    const result = extractMLBRealPregameWinnerFeatureVectorV1(snapshot);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.values.find((v) => v.featureId === 'homeWinRate')?.value).toBeCloseTo(0.6);
    expect(result.value.values.find((v) => v.featureId === 'homeRunsScoredPerGame')?.value).toBe(5.1);
    expect(result.value.values.find((v) => v.featureId === 'homeRunsAllowedPerGame')?.value).toBe(3.2);
    expect(result.value.values.find((v) => v.featureId === 'awayWinRate')?.value).toBe(0.5);
    expect(result.value.values.find((v) => v.featureId === 'awayRunsScoredPerGame')?.value).toBe(4.2);
    expect(result.value.values.find((v) => v.featureId === 'awayRunsAllowedPerGame')?.value).toBe(3.8);
  });

  it('propagates snapshot validation failures unchanged', () => {
    const badSnapshot = { ...buildValidSnapshot(), game: null } as unknown as MLBCanonicalPregameSnapshot;
    const result = extractMLBRealPregameWinnerFeatureVectorV1(badSnapshot);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'SNAPSHOT_INVALID')).toBe(true);
    }
  });

  it('binds to the exact committed manifest identity', () => {
    expect(extractMLBRealPregameWinnerFeatureVectorV1).toBeDefined();
    expect(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT).toBe(
      '8d5c2077c52359a429ddfed074ebbb7541df40fb5bfec9d468dd4ac76706e101',
    );
  });

  it('imports no postgame or outcome logic', () => {
    const source = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src', 'prediction', 'mlb', 'mlb-real-pregame-winner-feature-vector-v1.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/historical-labelled-dataset|outcome-contract|final-score|grading|recommendation|multi|staking/);
  });

  it('passes the odds contamination guard on the production source text', () => {
    const source = require('fs').readFileSync(
      require('path').join(process.cwd(), 'src', 'prediction', 'mlb', 'mlb-real-pregame-winner-feature-vector-v1.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/odds|moneyline|spread|implied probability|edge|value|CLV|stake|bankroll|ROI/);
  });
});
