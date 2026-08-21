import { describe, expect, it } from 'vitest';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH,
  type MLBInnerDevelopmentTrainArtifactRuntimeProvenance,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-runtime-provenance';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
} from '@/prediction/mlb/mlb-inner-development-train-artifact';

const HEX_RE = /^[0-9a-f]{64}$/;

describe('MLBInnerDevelopmentTrainArtifactRuntimeProvenance', () => {
  it('frozen SHA exact value matches expected literal', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256).toBe(
      '426c01c097c24fb9dffbbcbb5ec3fb1d026e8edc24454f33f13b660719612454',
    );
  });

  it('SHA format is 64 lowercase hex', () => {
    expect(HEX_RE.test(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256)).toBe(true);
  });

  it('byte length is exact positive safe integer', () => {
    expect(Number.isSafeInteger(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH)).toBe(true);
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH).toBeGreaterThan(0);
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH).toBe(811149);
  });

  it('repository path is exact and relative', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH).toBe(
      'data/mlb/inner-development/mlb-inner-development-train-artifact-v1.json',
    );
  });

  it('path is not absolute', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH.startsWith('/')).toBe(false);
  });

  it('path contains no /Users path', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH).not.toContain('/Users/');
  });

  it('artifact/source linkage imported from PRE-I3A', () => {
    const provenance = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE;
    expect(provenance.artifactId).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID);
    expect(provenance.sourceDatasetId).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID);
    expect(provenance.sourceMatrixId).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID);
  });

  it('row count is 301', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE.rowCount).toBe(301);
  });

  it('date range Apr 1..Apr 23', () => {
    const provenance = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE;
    expect(provenance.firstOfficialDate).toBe('2026-04-01');
    expect(provenance.lastOfficialDate).toBe('2026-04-23');
  });

  it('feature manifest linkage', () => {
    const provenance = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE;
    expect(provenance.manifestId).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID);
  });

  it('feature and preprocessing policy linkage', () => {
    const provenance = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE;
    expect(provenance.featurePolicyId).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID);
    expect(provenance.preprocessingPolicyId).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID);
  });

  it('fold-plan linkage', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE.foldPlanId).toBe(
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
    );
  });

  it('no timestamp fields', () => {
    const provenance = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE as unknown as Record<string, unknown>;
    for (const key of Object.keys(provenance)) {
      const value = provenance[key];
      expect(
        key === 'createdAt' ||
          key === 'generatedAt' ||
          key === 'wall-clock timestamp' ||
          typeof value === 'number' && key.toLowerCase().includes('timestamp'),
      ).toBe(false);
    }
  });

  it('no candidate/model/campaign state', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE).not.toHaveProperty(
      'candidateId',
    );
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE).not.toHaveProperty(
      'modelMetrics',
    );
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE).not.toHaveProperty(
      'campaignRuntimeState',
    );
  });

  it('path alone is not represented as trust identity', () => {
    const provenance = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_RUNTIME_PROVENANCE;
    expect(provenance.expectedSha256).toBe(
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    );
    expect(provenance.repositoryPath).toBe(
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH,
    );
    expect(provenance.expectedSha256).not.toBe(
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH,
    );
  });
});
