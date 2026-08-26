import { TextEncoder } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-runtime-provenance';
import {
  MLBInnerDevelopmentTrainArtifact,
  buildMLBInnerDevelopmentTrainArtifact,
} from '@/prediction/mlb/mlb-inner-development-train-artifact';
import {
  type MLBTrainOnlyInnerRowCollection,
  type MLBOuterTrainRow,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
  MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
} from '@/prediction/mlb/mlb-outer-validation-promotion-contract';
import {
  MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION,
  type MLBOuterValidationTrainSource,
  validateMLBOuterValidationTrainSource,
} from '@/prediction/mlb/mlb-outer-validation-train-source-contract';

const FEATURE_IDS = [
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

function buildSyntheticTrainRows(count: number): MLBOuterTrainRow[] {
  const rows: MLBOuterTrainRow[] = [];
  let exampleCounter = 1;

  for (let day = 1; day <= 23; day++) {
    const officialDate = `2026-04-${String(day).padStart(2, '0')}`;
    for (let game = 1; game <= 14; game++) {
      if (rows.length >= count) break;
      const gameId = `synth-${officialDate}-${String(game).padStart(3, '0')}`;
      const snapshotId = `snap-${officialDate}-${String(game).padStart(3, '0')}`;
      const exampleId = `example-${String(exampleCounter).padStart(3, '0')}`;
      exampleCounter += 1;

      const values = Array.from({ length: 14 }, (_, idx) => ({
        featureId: FEATURE_IDS[idx],
        value: idx % 2 === 0 ? 1 : 0,
        wasMissing: false,
      }));

      rows.push({
        exampleId,
        split: 'TRAIN',
        vector: {
          contractVersion: 'mlb-feature-vector-v1',
          sport: 'MLB',
          target: 'OFFICIAL_FINAL_GAME_WINNER',
          manifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
          snapshotId,
          gameId,
          officialDate,
          dataCutoffAt: '2026-04-23T23:59:59.999Z',
          values,
        },
        targetValue: game % 2 === 0 ? 1 : 0,
      });
    }
    if (rows.length >= count) break;
  }

  return rows;
}

function buildSyntheticArtifact(): MLBInnerDevelopmentTrainArtifact {
  const rows = buildSyntheticTrainRows(301);
  const rowCollection: MLBTrainOnlyInnerRowCollection = {
    contractVersion: 'mlb-train-only-inner-row-collection-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    matrixId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360::mlb-real-pregame-winner-feature-manifest-v1',
    manifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    datasetId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360',
    rowCount: 301,
    homeWinCount: 150,
    awayWinCount: 151,
    rows,
  };

  return buildMLBInnerDevelopmentTrainArtifact(rowCollection);
}

function buildValidSource(): MLBOuterValidationTrainSource {
  return {
    contractVersion: MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION,
    verifiedArtifact: buildSyntheticArtifact(),
    verifiedArtifactSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    verifiedArtifactByteLength: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
    outerBinding: {
      datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
      datasetSha256: MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
      matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
      manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
      trainingRowCount: 301,
    },
  };
}

function buildMutableSource(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(buildValidSource()));
}

describe('mlb-outer-validation-train-source-contract', () => {
  it('1: accepts valid source', () => {
    const result = validateMLBOuterValidationTrainSource(buildValidSource());
    expect(result.ok).toBe(true);
  });

  it('2: rejects unknown enumerable field', () => {
    const source = buildMutableSource();
    (source as unknown as Record<string, unknown>).evil = 'field';
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'UNKNOWN_FIELD')).toBe(true);
    }
  });

  it('3: rejects unknown non-enumerable field', () => {
    const source = buildValidSource();
    Object.defineProperty(source, 'evil', {
      value: 'field',
      enumerable: false,
      writable: true,
      configurable: true,
    });
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'UNKNOWN_FIELD')).toBe(true);
    }
  });

  it('4: rejects symbol key', () => {
    const source = buildMutableSource();
    (source as unknown as Record<symbol, unknown>)[Symbol('evil')] = 'field';
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'UNKNOWN_FIELD')).toBe(true);
    }
  });

  it('5: rejects accessor property', () => {
    const source = {
      contractVersion: MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION,
      get verifiedArtifact() {
        return buildSyntheticArtifact();
      },
      verifiedArtifactSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
      verifiedArtifactByteLength: 811149,
      outerBinding: {
        datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
        datasetSha256: MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
        matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
        manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
        trainingRowCount: 301,
      },
    };
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'INVALID_JSON_VALUE' && issue.path === '$.verifiedArtifact')).toBe(true);
    }
  });

  it('6: rejects wrong contract version', () => {
    const source = buildValidSource();
    (source as unknown as Record<string, unknown>).contractVersion = 'other-version';
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL' && issue.path === '$.contractVersion')).toBe(true);
    }
  });

  it('7: rejects wrong artifact ID', () => {
    const source = buildValidSource();
    const artifact = source.verifiedArtifact;
    const fakeArtifact = {
      artifactContractVersion: artifact.artifactContractVersion,
      artifactId: 'other-id',
      sourceDatasetId: artifact.sourceDatasetId,
      featureManifestId: artifact.featureManifestId,
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: artifact.rowCount,
      firstOfficialDate: artifact.firstOfficialDate,
      lastOfficialDate: artifact.lastOfficialDate,
      foldPlanId: artifact.foldPlanId,
      rowCollection: artifact.rowCollection,
    } as unknown as MLBInnerDevelopmentTrainArtifact;
    const mutated = {
      ...source,
      verifiedArtifact: fakeArtifact,
    } as MLBOuterValidationTrainSource;
    const result = validateMLBOuterValidationTrainSource(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'VERIFIED_ARTIFACT_INVALID')).toBe(true);
    }
  });

  it('8: rejects wrong TRAIN source dataset ID', () => {
    const source = buildValidSource();
    const artifact = source.verifiedArtifact;
    const fakeArtifact = {
      artifactContractVersion: artifact.artifactContractVersion,
      artifactId: artifact.artifactId,
      sourceDatasetId: 'other-dataset',
      featureManifestId: artifact.featureManifestId,
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: artifact.rowCount,
      firstOfficialDate: artifact.firstOfficialDate,
      lastOfficialDate: artifact.lastOfficialDate,
      foldPlanId: artifact.foldPlanId,
      rowCollection: artifact.rowCollection,
    } as unknown as MLBInnerDevelopmentTrainArtifact;
    const mutated = {
      ...source,
      verifiedArtifact: fakeArtifact,
    } as MLBOuterValidationTrainSource;
    const result = validateMLBOuterValidationTrainSource(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'VERIFIED_ARTIFACT_INVALID')).toBe(true);
    }
  });

  it('9: rejects wrong source matrix ID', () => {
    const source = buildValidSource();
    const artifact = source.verifiedArtifact;
    const fakeArtifact = {
      artifactContractVersion: artifact.artifactContractVersion,
      artifactId: artifact.artifactId,
      sourceDatasetId: artifact.sourceDatasetId,
      featureManifestId: artifact.featureManifestId,
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: artifact.rowCount,
      firstOfficialDate: artifact.firstOfficialDate,
      lastOfficialDate: artifact.lastOfficialDate,
      foldPlanId: artifact.foldPlanId,
      rowCollection: {
        ...artifact.rowCollection,
        matrixId: 'other-matrix',
      },
    } as unknown as MLBInnerDevelopmentTrainArtifact;
    const mutated = {
      ...source,
      verifiedArtifact: fakeArtifact,
    } as MLBOuterValidationTrainSource;
    const result = validateMLBOuterValidationTrainSource(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'VERIFIED_ARTIFACT_INVALID')).toBe(true);
    }
  });

  it('10: rejects wrong first date', () => {
    const source = buildValidSource();
    const artifact = source.verifiedArtifact;
    const fakeArtifact = {
      artifactContractVersion: artifact.artifactContractVersion,
      artifactId: artifact.artifactId,
      sourceDatasetId: artifact.sourceDatasetId,
      featureManifestId: artifact.featureManifestId,
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: artifact.rowCount,
      firstOfficialDate: '2026-04-02',
      lastOfficialDate: artifact.lastOfficialDate,
      foldPlanId: artifact.foldPlanId,
      rowCollection: artifact.rowCollection,
    } as unknown as MLBInnerDevelopmentTrainArtifact;
    const mutated = {
      ...source,
      verifiedArtifact: fakeArtifact,
    } as MLBOuterValidationTrainSource;
    const result = validateMLBOuterValidationTrainSource(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'VERIFIED_ARTIFACT_INVALID')).toBe(true);
    }
  });

  it('11: rejects wrong last date', () => {
    const source = buildValidSource();
    const artifact = source.verifiedArtifact;
    const fakeArtifact = {
      artifactContractVersion: artifact.artifactContractVersion,
      artifactId: artifact.artifactId,
      sourceDatasetId: artifact.sourceDatasetId,
      featureManifestId: artifact.featureManifestId,
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: artifact.rowCount,
      firstOfficialDate: artifact.firstOfficialDate,
      lastOfficialDate: '2026-04-24',
      foldPlanId: artifact.foldPlanId,
      rowCollection: artifact.rowCollection,
    } as unknown as MLBInnerDevelopmentTrainArtifact;
    const mutated = {
      ...source,
      verifiedArtifact: fakeArtifact,
    } as MLBOuterValidationTrainSource;
    const result = validateMLBOuterValidationTrainSource(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'VERIFIED_ARTIFACT_INVALID')).toBe(true);
    }
  });

  it('12: rejects wrong row count', () => {
    const source = buildValidSource();
    const artifact = source.verifiedArtifact;
    const fakeArtifact = {
      artifactContractVersion: artifact.artifactContractVersion,
      artifactId: artifact.artifactId,
      sourceDatasetId: artifact.sourceDatasetId,
      featureManifestId: artifact.featureManifestId,
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: 100,
      firstOfficialDate: artifact.firstOfficialDate,
      lastOfficialDate: artifact.lastOfficialDate,
      foldPlanId: artifact.foldPlanId,
      rowCollection: artifact.rowCollection,
    } as unknown as MLBInnerDevelopmentTrainArtifact;
    const mutated = {
      ...source,
      verifiedArtifact: fakeArtifact,
    } as MLBOuterValidationTrainSource;
    const result = validateMLBOuterValidationTrainSource(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'VERIFIED_ARTIFACT_INVALID')).toBe(true);
    }
  });

  it('13: rejects non-TRAIN row', () => {
    const source = buildValidSource();
    const artifact = source.verifiedArtifact;
    const fakeArtifact = {
      artifactContractVersion: artifact.artifactContractVersion,
      artifactId: artifact.artifactId,
      sourceDatasetId: artifact.sourceDatasetId,
      featureManifestId: artifact.featureManifestId,
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: artifact.rowCount + 1,
      firstOfficialDate: artifact.firstOfficialDate,
      lastOfficialDate: artifact.lastOfficialDate,
      foldPlanId: artifact.foldPlanId,
      rowCollection: {
        ...artifact.rowCollection,
        rows: [
          ...artifact.rowCollection.rows,
          {
            exampleId: 'evil',
            split: 'VALIDATION',
            vector: artifact.rowCollection.rows[0].vector,
            targetValue: 1,
          },
        ],
      },
    } as unknown as MLBInnerDevelopmentTrainArtifact;
    const mutated = {
      ...source,
      verifiedArtifact: fakeArtifact,
    } as MLBOuterValidationTrainSource;
    const result = validateMLBOuterValidationTrainSource(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'VERIFIED_ARTIFACT_INVALID')).toBe(true);
    }
  });

  it('14: rejects wrong manifest identity in artifact', () => {
    const source = buildValidSource();
    const artifact = source.verifiedArtifact;
    const fakeArtifact = {
      artifactContractVersion: artifact.artifactContractVersion,
      artifactId: artifact.artifactId,
      sourceDatasetId: artifact.sourceDatasetId,
      featureManifestId: 'other-manifest',
      featurePolicyId: artifact.featurePolicyId,
      preprocessingPolicyId: artifact.preprocessingPolicyId,
      split: artifact.split,
      rowCount: artifact.rowCount,
      firstOfficialDate: artifact.firstOfficialDate,
      lastOfficialDate: artifact.lastOfficialDate,
      foldPlanId: artifact.foldPlanId,
      rowCollection: artifact.rowCollection,
    } as unknown as MLBInnerDevelopmentTrainArtifact;
    const mutated = {
      ...source,
      verifiedArtifact: fakeArtifact,
    } as MLBOuterValidationTrainSource;
    const result = validateMLBOuterValidationTrainSource(mutated);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'VERIFIED_ARTIFACT_INVALID')).toBe(true);
    }
  });

  it('15: rejects mutation to outer dataset ID', () => {
    const source = buildMutableSource();
    (source as unknown as Record<string, unknown>).outerBinding = {
      ...(source.outerBinding as Record<string, unknown>),
      datasetId: 'other-dataset',
    };
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL' && issue.path === '$.outerBinding.datasetId')).toBe(true);
    }
  });

  it('16: rejects mutation to outer dataset SHA256', () => {
    const source = buildMutableSource();
    (source as unknown as Record<string, unknown>).outerBinding = {
      ...(source.outerBinding as Record<string, unknown>),
      datasetSha256: 'a'.repeat(64),
    };
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL' && issue.path === '$.outerBinding.datasetSha256')).toBe(true);
    }
  });

  it('17: rejects mutation to outer matrix ID', () => {
    const source = buildMutableSource();
    (source as unknown as Record<string, unknown>).outerBinding = {
      ...(source.outerBinding as Record<string, unknown>),
      matrixId: 'other-matrix',
    };
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL' && issue.path === '$.outerBinding.matrixId')).toBe(true);
    }
  });

  it('18: rejects mutation to outer manifest ID', () => {
    const source = buildMutableSource();
    (source as unknown as Record<string, unknown>).outerBinding = {
      ...(source.outerBinding as Record<string, unknown>),
      manifestId: 'other-manifest',
    };
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL' && issue.path === '$.outerBinding.manifestId')).toBe(true);
    }
  });

  it('19: rejects mutation to outer training row count', () => {
    const source = buildMutableSource();
    (source as unknown as Record<string, unknown>).outerBinding = {
      ...(source.outerBinding as Record<string, unknown>),
      trainingRowCount: 999,
    };
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'INVALID_LITERAL' && issue.path === '$.outerBinding.trainingRowCount')).toBe(true);
    }
  });

  it('20: rejects missing outerBinding', () => {
    const source = buildValidSource();
    delete (source as unknown as Record<string, unknown>).outerBinding;
    const result = validateMLBOuterValidationTrainSource(source);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'MISSING_FIELD' && issue.path === '$.outerBinding')).toBe(true);
    }
  });
});
