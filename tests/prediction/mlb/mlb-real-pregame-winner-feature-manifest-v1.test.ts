import { describe, expect, it } from 'vitest';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
  computeMLBFeatureManifestFingerprint,
  areMLBFeatureManifestsCompatible,
  serializeMLBFeatureManifestFingerprintPayload,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  MLB_FEATURE_MANIFEST_CONTRACT_VERSION,
  MLBFeatureManifest,
  MLBFeatureDefinition,
  validateMLBFeatureManifest,
  extractMLBLeakageSafeFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import { MLBCanonicalPregameSnapshot, MLBPregameSnapshotSection } from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import { assertNoOddsContamination } from '@/prediction/firewall/odds-contamination-guard';

const EXPECTED_FEATURE_IDS_IN_ORDER = [
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

const EXPECTED_FEATURE_DEFINITIONS: Record<
  string,
  {
    sectionId: string;
    payloadPath: readonly string[];
    valueKind: 'NUMBER' | 'BOOLEAN';
    missingPolicy: 'REJECT' | 'USE_DEFAULT';
    defaultValue: number | null;
  }
> = {
  awayBullpenExtraInningGames: {
    sectionId: 'section-away-bullpen',
    payloadPath: ['recentWorkload', 'extraInningGames'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  awayBullpenGamesInPrevious3Days: {
    sectionId: 'section-away-bullpen',
    payloadPath: ['recentWorkload', 'gamesInPrevious3Days'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  awayRunsAllowedPerGame: {
    sectionId: 'section-away-batting',
    payloadPath: ['seasonStats', 'runsAllowedPerGame'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  awayRunsScoredPerGame: {
    sectionId: 'section-away-batting',
    payloadPath: ['seasonStats', 'runsScoredPerGame'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  awayStarterAvailable: {
    sectionId: 'section-away-starter',
    payloadPath: ['availability'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  awayWinRate: {
    sectionId: 'section-away-batting',
    payloadPath: ['seasonStats', 'winRate'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0.5,
  },
  doubleHeaderGameNumber: {
    sectionId: 'section-game-context',
    payloadPath: ['doubleHeaderGameNumber'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  homeBullpenExtraInningGames: {
    sectionId: 'section-home-bullpen',
    payloadPath: ['recentWorkload', 'extraInningGames'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  homeBullpenGamesInPrevious3Days: {
    sectionId: 'section-home-bullpen',
    payloadPath: ['recentWorkload', 'gamesInPrevious3Days'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  homeRunsAllowedPerGame: {
    sectionId: 'section-home-batting',
    payloadPath: ['seasonStats', 'runsAllowedPerGame'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  homeRunsScoredPerGame: {
    sectionId: 'section-home-batting',
    payloadPath: ['seasonStats', 'runsScoredPerGame'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  homeStarterAvailable: {
    sectionId: 'section-home-starter',
    payloadPath: ['availability'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0,
  },
  homeWinRate: {
    sectionId: 'section-home-batting',
    payloadPath: ['seasonStats', 'winRate'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 0.5,
  },
  scheduledInnings: {
    sectionId: 'section-game-context',
    payloadPath: ['scheduledInnings'],
    valueKind: 'NUMBER',
    missingPolicy: 'USE_DEFAULT',
    defaultValue: 9,
  },
};

describe('MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1', () => {
  it('accepts the concrete V1 manifest', () => {
    const result = validateMLBFeatureManifest(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1);
    expect(result.ok).toBe(true);
  });

  it('has exact manifestId', () => {
    expect(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId).toBe(
      'mlb-real-pregame-winner-feature-manifest-v1',
    );
  });

  it('has exactly 14 logical features', () => {
    expect(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features).toHaveLength(14);
  });

  it('has exact feature IDs in canonical order', () => {
    const ids = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
      (feature) => feature.featureId,
    );
    expect(ids).toEqual(EXPECTED_FEATURE_IDS_IN_ORDER);
  });

  it('has exact feature definitions', () => {
    for (const feature of MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features) {
      const expected = EXPECTED_FEATURE_DEFINITIONS[feature.featureId];
      expect(expected).toBeDefined();
      expect(feature.sectionId).toBe(expected.sectionId);
      expect(feature.payloadPath).toEqual(expected.payloadPath);
      expect(feature.valueKind).toBe(expected.valueKind);
      expect(feature.missingPolicy).toBe(expected.missingPolicy);
      expect(feature.defaultValue).toBe(expected.defaultValue);
    }
  });

  it('has no duplicate feature IDs', () => {
    const seen = new Set<string>();
    for (const feature of MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features) {
      expect(seen.has(feature.featureId)).toBe(false);
      seen.add(feature.featureId);
    }
  });

  it('has all finite defaults', () => {
    for (const feature of MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features) {
      if (feature.missingPolicy === 'USE_DEFAULT') {
        expect(Number.isFinite(feature.defaultValue)).toBe(true);
      }
    }
  });

  it('contains no derived differential features', () => {
    const derivedIds = [
      'winRateDiff',
      'runsScoredPerGameDiff',
      'runsAllowedPerGameDiff',
      'starterAvailabilityDiff',
    ];
    const ids = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
      (feature) => feature.featureId,
    );
    for (const derivedId of derivedIds) {
      expect(ids).not.toContain(derivedId);
    }
  });

  it('contains no constant homeAdvantage feature', () => {
    const ids = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
      (feature) => feature.featureId,
    );
    expect(ids).not.toContain('homeAdvantage');
  });

  it('contains no separate missingness feature IDs', () => {
    for (const feature of MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features) {
      expect(feature.featureId.endsWith('WasMissing')).toBe(false);
    }
  });

  it('contains no gameType feature', () => {
    const ids = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
      (feature) => feature.featureId,
    );
    expect(ids).not.toContain('gameType');
  });

  it('contains no neutralSite feature', () => {
    const ids = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
      (feature) => feature.featureId,
    );
    expect(ids).not.toContain('neutralSite');
  });

  it('rejects odds-contaminated manifest inputs', () => {
    expect(() => {
      assertNoOddsContamination({
        contractVersion: MLB_FEATURE_MANIFEST_CONTRACT_VERSION,
        sport: 'MLB',
        target: 'OFFICIAL_FINAL_GAME_WINNER',
        manifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
        features: [],
        sportsbook: 'forbidden',
      });
    }).toThrow();
  });
});

describe('computeMLBFeatureManifestFingerprint', () => {
  it('returns the same fingerprint on repeated calls', () => {
    const first = computeMLBFeatureManifestFingerprint(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
    const second = computeMLBFeatureManifestFingerprint(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.fingerprint).toBe(first.fingerprint);
    }
  });

  it('produces a 64-character lowercase hex fingerprint', () => {
    const result = computeMLBFeatureManifestFingerprint(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fingerprint).toHaveLength(64);
      expect(result.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('matches the independently computed frozen constant', () => {
    const result = computeMLBFeatureManifestFingerprint(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fingerprint).toBe(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT);
    }
  });

  it('rejects invalid manifests', () => {
    const result = computeMLBFeatureManifestFingerprint({
      contractVersion: MLB_FEATURE_MANIFEST_CONTRACT_VERSION,
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      manifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
      features: [],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects an invalid reordered manifest', () => {
    const originalResult = computeMLBFeatureManifestFingerprint(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
    expect(originalResult.ok).toBe(true);

    const mutated = Object.freeze({
      ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      features: Object.freeze(
        Array.from(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features).reverse(),
      ) as readonly MLBFeatureDefinition[],
    }) as MLBFeatureManifest;

    const mutatedResult = computeMLBFeatureManifestFingerprint(mutated);
    expect(mutatedResult.ok).toBe(false);
  });

  it('changes when payloadPath is changed on a retained feature', () => {
    const originalResult = computeMLBFeatureManifestFingerprint(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
    expect(originalResult.ok).toBe(true);

    const mutated = {
      ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      features: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
        (feature) =>
          feature.featureId === 'doubleHeaderGameNumber'
            ? ({ ...feature, payloadPath: ['different', 'path'] } as MLBFeatureDefinition)
            : feature,
      ),
    } as MLBFeatureManifest;

    const mutatedResult = computeMLBFeatureManifestFingerprint(mutated);
    expect(mutatedResult.ok).toBe(true);
    if (mutatedResult.ok && originalResult.ok) {
      expect(mutatedResult.fingerprint).not.toBe(originalResult.fingerprint);
    }
  });

  it('changes when missingPolicy is changed on a USE_DEFAULT feature', () => {
    const originalResult = computeMLBFeatureManifestFingerprint(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
    expect(originalResult.ok).toBe(true);

    const mutated = {
      ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      features: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
        (feature) =>
          feature.featureId === 'scheduledInnings'
            ? ({ ...feature, missingPolicy: 'REJECT', defaultValue: null } as MLBFeatureDefinition)
            : feature,
      ),
    } as MLBFeatureManifest;

    const mutatedResult = computeMLBFeatureManifestFingerprint(mutated);
    expect(mutatedResult.ok).toBe(true);
    if (mutatedResult.ok && originalResult.ok) {
      expect(mutatedResult.fingerprint).not.toBe(originalResult.fingerprint);
    }
  });

  it('changes when valueKind is changed on a NUMBER feature', () => {
    const originalResult = computeMLBFeatureManifestFingerprint(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    );
    expect(originalResult.ok).toBe(true);

    const mutated = {
      ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      features: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
        (feature) =>
          feature.featureId === 'homeWinRate'
            ? ({ ...feature, valueKind: 'BOOLEAN' } as MLBFeatureDefinition)
            : feature,
      ),
    } as MLBFeatureManifest;

    const mutatedResult = computeMLBFeatureManifestFingerprint(mutated);
    expect(mutatedResult.ok).toBe(true);
    if (mutatedResult.ok && originalResult.ok) {
      expect(mutatedResult.fingerprint).not.toBe(originalResult.fingerprint);
    }
  });
});

describe('serializeMLBFeatureManifestFingerprintPayload', () => {
  it('produces stable output for the same manifest', () => {
    const payload = serializeMLBFeatureManifestFingerprintPayload({
      contractVersion: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.contractVersion,
      manifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      features: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
        (feature) => ({
          featureId: feature.featureId,
          sectionId: feature.sectionId,
          payloadPath: feature.payloadPath as readonly string[],
          valueKind: feature.valueKind,
          missingPolicy: feature.missingPolicy,
          defaultValue: feature.defaultValue,
        }),
      ),
    });
    expect(payload).toBe(serializeMLBFeatureManifestFingerprintPayload(JSON.parse(payload)));
  });
});

describe('areMLBFeatureManifestsCompatible', () => {
  it('returns true for identical semantic manifests', () => {
    const clone = {
      ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    } as MLBFeatureManifest;
    expect(areMLBFeatureManifestsCompatible(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      clone,
    )).toBe(true);
  });

  it('returns false when feature order differs', () => {
    const originalFeatures = Array.from(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features,
    );
    const features = Array.from(originalFeatures);
    const first = features[0];
    const second = features[1];
    features[0] = second;
    features[1] = first;
    const mutated = Object.freeze({
      ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      features: Object.freeze(features) as readonly MLBFeatureDefinition[],
    }) as MLBFeatureManifest;
    expect(areMLBFeatureManifestsCompatible(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      mutated,
    )).toBe(false);
  });

  it('returns false when feature definition differs', () => {
    const mutated = {
      ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      features: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
        (feature) =>
          feature.featureId === 'doubleHeaderGameNumber'
            ? ({ ...feature, payloadPath: ['different', 'path'] } as MLBFeatureDefinition)
            : feature,
      ),
    } as MLBFeatureManifest;
    expect(areMLBFeatureManifestsCompatible(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      mutated,
    )).toBe(false);
  });

  it('returns false when manifestId matches but features differ', () => {
    const mutated = {
      ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      manifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      features: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.filter(
        (feature) => feature.featureId !== 'scheduledInnings',
      ),
    } as MLBFeatureManifest;
    expect(areMLBFeatureManifestsCompatible(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
      mutated,
    )).toBe(false);
  });
});

describe('manifest dataset independence', () => {
  it('does not contain dataset date coupling in manifestId', () => {
    expect(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId.includes('2026-04-01'),
    ).toBe(false);
  });

  it('does not contain dataset date coupling in fingerprint payload', () => {
    const payload = serializeMLBFeatureManifestFingerprintPayload({
      contractVersion: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.contractVersion,
      manifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      features: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
        (feature) => ({
          featureId: feature.featureId,
          sectionId: feature.sectionId,
          payloadPath: feature.payloadPath as readonly string[],
          valueKind: feature.valueKind,
          missingPolicy: feature.missingPolicy,
          defaultValue: feature.defaultValue,
        }),
      ),
    });
    expect(payload).not.toContain('datasetId');
    expect(payload).not.toContain('matrixId');
    expect(payload).not.toContain('2026-04-01');
  });

  it('fingerprint payload contains no runtime timestamp or filesystem path', () => {
    const payload = serializeMLBFeatureManifestFingerprintPayload({
      contractVersion: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.contractVersion,
      manifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
      features: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
        (feature) => ({
          featureId: feature.featureId,
          sectionId: feature.sectionId,
          payloadPath: feature.payloadPath as readonly string[],
          valueKind: feature.valueKind,
          missingPolicy: feature.missingPolicy,
          defaultValue: feature.defaultValue,
        }),
      ),
    });
    expect(payload).not.toMatch(/\"[0-9]{4}-[0-9]{2}-[0-9]{2}T/);
    expect(payload).not.toMatch(/\/tmp\//);
    expect(payload).not.toMatch(/\/Users\//);
  });
});

describe('extractMLBLeakageSafeFeatureVector - doubleHeaderGameNumber parity', () => {
  function buildGameContextSection(
    overrides: Record<string, unknown> = {},
  ): MLBPregameSnapshotSection {
    return {
      sectionId: 'section-game-context',
      kind: 'GAME_CONTEXT',
      entity: { scope: 'GAME', entityId: null },
      status: 'AVAILABLE',
      asOfAt: '2026-07-15T06:00:00.000Z',
      sourceRefIds: ['src-schedule'],
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
    };
  }

  function buildSnapshot(
    overrides: Record<string, unknown> = {},
    gameOverrides: Record<string, unknown> = {},
  ): MLBCanonicalPregameSnapshot {
    return {
      contractVersion: 'mlb-canonical-pregame-snapshot-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      snapshotId: '12345::1::pregame-snapshot-v1',
      capturedAt: '2026-07-15T10:00:00Z',
      dataCutoffAt: '2026-07-15T09:00:00Z',
      game: {
        gameId: '12345',
        officialDate: '2026-07-15',
        season: 2026,
        homeTeamId: '110',
        awayTeamId: '111',
        scheduledStartAt: '2026-07-15T12:00:00.000Z',
        status: 'SCHEDULED',
        gameType: 'REGULAR_SEASON',
        venueId: '1',
        neutralSite: null,
        doubleheader: null,
        ...gameOverrides,
      },
      sourceReferences: [
        {
          sourceRefId: 'src-schedule',
          sourceName: 'mlb-stats-api:schedule',
          sourceCategory: 'OFFICIAL',
          providerRecordId: null,
          roles: ['GAME_IDENTITY', 'SCHEDULE_CONTEXT', 'TEAM_PLAYER_IDENTITY'],
          fetchedAt: '2026-07-15T06:00:00.000Z',
          sourceUpdatedAt: null,
        },
      ],
      dataCompleteness: 'COMPLETE',
      warnings: [],
      sections: [buildGameContextSection()],
      startingPitchers: {
        home: {
          state: 'UNAVAILABLE',
          pitcherId: null,
          announcedAt: null,
          sourceRefIds: [],
        },
        away: {
          state: 'UNAVAILABLE',
          pitcherId: null,
          announcedAt: null,
          sourceRefIds: [],
        },
      },
      ...overrides,
    };
  }

  it('extracts doubleHeaderGameNumber = 2 with wasMissing = false for a doubleheader game', () => {
    const snapshot = buildSnapshot(
      { sections: [buildGameContextSection({ doubleHeaderGameNumber: 2 })] },
      { doubleheader: { doubleheaderId: '10:2026-07-153:1103:111', gameNumber: 2 } },
    );
    const result = extractMLBLeakageSafeFeatureVector(
      { ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1 },
      snapshot,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const entry = result.value.values.find((v) => v.featureId === 'doubleHeaderGameNumber');
      expect(entry).toBeDefined();
      expect(entry?.value).toBe(2);
      expect(entry?.wasMissing).toBe(false);
    }
  });

  it('extracts doubleHeaderGameNumber = 0 with wasMissing = true when payload is absent', () => {
    const snapshot = buildSnapshot(
      { sections: [buildGameContextSection()] },
      { doubleheader: null },
    );
    const result = extractMLBLeakageSafeFeatureVector(
      { ...MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1 },
      snapshot,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      const entry = result.value.values.find((v) => v.featureId === 'doubleHeaderGameNumber');
      expect(entry).toBeDefined();
      expect(entry?.value).toBe(0);
      expect(entry?.wasMissing).toBe(true);
    }
  });
});
