import { describe, expect, it } from 'vitest';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  validateMLBFeatureVector,
  validateMLBFeatureManifest,
  extractMLBLeakageSafeFeatureVector,
  type MLBFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  validateMLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  applyCandidate003ProspectiveFeatureCompatibility,
} from '@/prediction/mlb/mlb-candidate-003-prospective-feature-compatibility';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';

const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';

const ALL_FEATURE_IDS = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
  (f) => f.featureId,
);

function buildDistinctValues(): Record<string, number> {
  return {
    awayBullpenExtraInningGames: 1,
    awayBullpenGamesInPrevious3Days: 2,
    awayRunsAllowedPerGame: 3,
    awayRunsScoredPerGame: 4,
    awayStarterAvailable: 5,
    awayWinRate: 6,
    doubleHeaderGameNumber: 7,
    homeBullpenExtraInningGames: 8,
    homeBullpenGamesInPrevious3Days: 9,
    homeRunsAllowedPerGame: 10,
    homeRunsScoredPerGame: 11,
    homeStarterAvailable: 12,
    homeWinRate: 13,
    scheduledInnings: 14,
  };
}

function buildVector(overrides: Record<string, unknown> = {}): unknown {
  const values = ALL_FEATURE_IDS.map((featureId) => ({
    featureId,
    value: buildDistinctValues()[featureId],
    wasMissing: false,
  }));

  return {
    contractVersion: 'mlb-feature-vector-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId,
    snapshotId: 'snapshot-1',
    gameId: 'game-1',
    officialDate: '2026-07-15',
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    values,
    ...overrides,
  };
}

function buildValidVector(overrides: Record<string, unknown> = {}): MLBFeatureVector {
  const raw = buildVector(overrides);
  const validation = validateMLBFeatureVector(raw);
  expect(validation.ok).toBe(true);
  if (validation.ok) {
    return validation.value;
  }
  throw new Error('Failed to build valid vector');
}

describe('mlb-candidate-003-prospective-feature-compatibility', () => {
  describe('starter compatibility projection', () => {
    it('forces homeStarterAvailable to 0/wasMissing true regardless of input', () => {
      const vector = buildValidVector();
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const home = result.value.values.find((v) => v.featureId === 'homeStarterAvailable');
        expect(home).toBeDefined();
        expect(home?.value).toBe(0);
        expect(home?.wasMissing).toBe(true);
      }
    });

    it('forces awayStarterAvailable to 0/wasMissing true regardless of input', () => {
      const vector = buildValidVector();
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const away = result.value.values.find((v) => v.featureId === 'awayStarterAvailable');
        expect(away).toBeDefined();
        expect(away?.value).toBe(0);
        expect(away?.wasMissing).toBe(true);
      }
    });

    it('projects starter value 0 / missing true -> 0 / missing true', () => {
      const vector = buildValidVector({
        values: ALL_FEATURE_IDS.map((featureId) => ({
          featureId,
          value: featureId === 'homeStarterAvailable' || featureId === 'awayStarterAvailable' ? 0 : buildDistinctValues()[featureId],
          wasMissing: featureId === 'homeStarterAvailable' || featureId === 'awayStarterAvailable',
        })),
      });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const home = result.value.values.find((v) => v.featureId === 'homeStarterAvailable');
        const away = result.value.values.find((v) => v.featureId === 'awayStarterAvailable');
        expect(home?.value).toBe(0);
        expect(home?.wasMissing).toBe(true);
        expect(away?.value).toBe(0);
        expect(away?.wasMissing).toBe(true);
      }
    });

    it('projects starter value 0 / missing false -> 0 / missing true', () => {
      const vector = buildValidVector({
        values: ALL_FEATURE_IDS.map((featureId) => ({
          featureId,
          value: featureId === 'homeStarterAvailable' || featureId === 'awayStarterAvailable' ? 0 : buildDistinctValues()[featureId],
          wasMissing: false,
        })),
      });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const home = result.value.values.find((v) => v.featureId === 'homeStarterAvailable');
        const away = result.value.values.find((v) => v.featureId === 'awayStarterAvailable');
        expect(home?.value).toBe(0);
        expect(home?.wasMissing).toBe(true);
        expect(away?.value).toBe(0);
        expect(away?.wasMissing).toBe(true);
      }
    });

    it('projects starter value 1 / missing false -> 0 / missing true', () => {
      const vector = buildValidVector({
        values: ALL_FEATURE_IDS.map((featureId) => ({
          featureId,
          value: featureId === 'homeStarterAvailable' || featureId === 'awayStarterAvailable' ? 1 : buildDistinctValues()[featureId],
          wasMissing: false,
        })),
      });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const home = result.value.values.find((v) => v.featureId === 'homeStarterAvailable');
        const away = result.value.values.find((v) => v.featureId === 'awayStarterAvailable');
        expect(home?.value).toBe(0);
        expect(home?.wasMissing).toBe(true);
        expect(away?.value).toBe(0);
        expect(away?.wasMissing).toBe(true);
      }
    });
  });

  describe('other 12 features preserved exactly', () => {
    it('preserves all non-starter features exactly', () => {
      const vector = buildValidVector();
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const featureId of ALL_FEATURE_IDS) {
          if (featureId === 'homeStarterAvailable' || featureId === 'awayStarterAvailable') {
            continue;
          }
          const projected = result.value.values.find((v) => v.featureId === featureId);
          expect(projected?.value).toBe(buildDistinctValues()[featureId]);
          expect(projected?.wasMissing).toBe(false);
        }
      }
    });

    it('preserves original missingness flags on non-starter features', () => {
      const vector = buildValidVector({
        values: ALL_FEATURE_IDS.map((featureId) => ({
          featureId,
          value: buildDistinctValues()[featureId],
          wasMissing: featureId === 'awayWinRate',
        })),
      });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const awayWinRate = result.value.values.find((v) => v.featureId === 'awayWinRate');
        expect(awayWinRate?.wasMissing).toBe(true);
        const homeStarter = result.value.values.find((v) => v.featureId === 'homeStarterAvailable');
        expect(homeStarter?.wasMissing).toBe(true);
      }
    });
  });

  describe('vector structure validation', () => {
    it('rejects wrong manifestId', () => {
      const vector = buildVector({ manifestId: 'wrong-manifest' });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('FEATURE_MANIFEST_MISMATCH');
      }
    });

    it('rejects wrong sport', () => {
      const vector = buildVector({ sport: 'NFL' });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('INVALID_FEATURE_VECTOR');
      }
    });

    it('rejects wrong target', () => {
      const vector = buildVector({ target: 'REGULATION_ONLY' });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('INVALID_FEATURE_VECTOR');
      }
    });

    it('rejects wrong feature count', () => {
      const base = buildVector() as Record<string, unknown>;
      const values = (base.values as unknown[]).slice(0, 2);
      const vector = buildVector({ values });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('FEATURE_MANIFEST_MISMATCH');
      }
    });

    it('rejects unknown feature IDs', () => {
      const base = buildVector() as Record<string, unknown>;
      const values = (base.values as unknown[]).map((v: unknown) => ({ ...(v as Record<string, unknown>), featureId: 'unknownFeature' }));
      const vector = buildVector({ values });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('INVALID_FEATURE_VECTOR');
      }
    });

    it('rejects duplicate starter features', () => {
      const base = buildVector() as Record<string, unknown>;
      const values = [
        ...(base.values as unknown[]),
        { featureId: 'homeStarterAvailable' as const, value: 0, wasMissing: true },
      ];
      const vector = buildVector({ values });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('INVALID_FEATURE_VECTOR');
      }
    });

    it('rejects missing starter feature', () => {
      const base = buildVector() as Record<string, unknown>;
      const values = (base.values as unknown[]).filter(
        (v: unknown) => (v as Record<string, unknown>).featureId !== 'homeStarterAvailable',
      );
      const vector = buildVector({ values });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('FEATURE_MANIFEST_MISMATCH');
      }
    });
  });

  describe('input immutability', () => {
    it('does not mutate input vector on success', () => {
      const vector = buildValidVector();
      const originalValues = JSON.parse(JSON.stringify(vector.values));
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(true);
      expect(vector.values).toEqual(originalValues);
    });

    it('does not mutate input vector on failure', () => {
      const vector = buildVector({ sport: 'NFL' });
      const originalValues = JSON.parse(JSON.stringify((vector as Record<string, unknown>).values));
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(false);
      expect((vector as Record<string, unknown>).values).toEqual(originalValues);
    });
  });

  describe('invalid input vectors', () => {
    it('rejects an invalid vector via authoritative validator', () => {
      const vector = buildVector({ values: null });
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.failureCode).toBe('INVALID_FEATURE_VECTOR');
      }
    });
  });

  describe('success result shape', () => {
    it('returns frozen projected vector with correct metadata', () => {
      const vector = buildValidVector();
      const result = applyCandidate003ProspectiveFeatureCompatibility(vector);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contractVersion).toBe('mlb-feature-vector-v1');
        expect(result.value.manifestId).toBe(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId);
        expect(result.value.sport).toBe('MLB');
        expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
        expect(result.value.values).toHaveLength(14);
      }
    });
  });
});
