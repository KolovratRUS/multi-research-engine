import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-runtime-provenance';
import {
  type MLBInnerDevelopmentTrainArtifactReader,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-provider';
import { loadMLBOuterValidationTrainSource } from '@/prediction/mlb/mlb-outer-validation-train-source-provider';

function buildReader(bytes: Uint8Array): MLBInnerDevelopmentTrainArtifactReader {
  return async () => bytes;
}

describe('mlb-outer-validation-train-source-provider', () => {
  const ARTIFACT_PATH = path.resolve(
    process.cwd(),
    MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH,
  );

  it('1: inner loader failure', async () => {
    const reader: MLBInnerDevelopmentTrainArtifactReader = async () => {
      throw new Error('fs error');
    };
    const result = await loadMLBOuterValidationTrainSource('/repo', reader);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'INNER_ARTIFACT_LOAD_FAILED')).toBe(true);
    }
  });

  it('2: hash mismatch', async () => {
    const realBytes = await readFile(ARTIFACT_PATH);
    const modified = new Uint8Array(realBytes);
    modified[0] = modified[0] === 123 ? 125 : 123; // flip { to } or vice versa
    const reader = buildReader(modified);
    const result = await loadMLBOuterValidationTrainSource('/repo', reader);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'ARTIFACT_HASH_MISMATCH')).toBe(true);
    }
  });

  it('3: invalid artifact bytes', async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({
      artifactContractVersion: 'mlb-inner-development-train-artifact-v1',
      artifactId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360::mlb-real-pregame-winner-feature-manifest-v1::train-only',
      sourceDatasetId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360',
      sourceMatrixId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360::mlb-real-pregame-winner-feature-manifest-v1',
      featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
      featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
      preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
      split: 'TRAIN',
      rowCount: 1,
      firstOfficialDate: '2026-04-01',
      lastOfficialDate: '2026-04-23',
      foldPlanId: 'mlb-v1-train-only-fold-plan-v1',
      rowCollection: {
        contractVersion: 'mlb-train-only-inner-row-collection-v1',
        sport: 'MLB',
        target: 'OFFICIAL_FINAL_GAME_WINNER',
        targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
        matrixId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360::mlb-real-pregame-winner-feature-manifest-v1',
        manifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
        datasetId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360',
        rowCount: 1,
        homeWinCount: 1,
        awayWinCount: 0,
        rows: [],
      },
    }));
    const reader = buildReader(bytes);
    const result = await loadMLBOuterValidationTrainSource('/repo', reader);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'ARTIFACT_HASH_MISMATCH')).toBe(true);
    }
  });

  it('4: canonical success', async () => {
    const bytes = await readFile(ARTIFACT_PATH);
    const reader = buildReader(bytes);
    const result = await loadMLBOuterValidationTrainSource('/repo', reader);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source.verifiedArtifact.rowCollection.rowCount).toBe(301);
      expect(result.source.outerBinding.trainingRowCount).toBe(301);
      expect(result.source.verifiedArtifact.rowCollection.datasetId).toBe(
        'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360',
      );
      expect(result.source.outerBinding.datasetId).toBe(
        'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360',
      );
      expect(result.source.verifiedArtifact.rowCollection.rows.every((row) => row.split === 'TRAIN')).toBe(
        true,
      );
    }
  });

  it('5: reader called exactly once with fixed path', async () => {
    let callCount = 0;
    let lastPath = '';
    const reader: MLBInnerDevelopmentTrainArtifactReader = async (resolvedPath) => {
      callCount += 1;
      lastPath = resolvedPath;
      return await readFile(ARTIFACT_PATH);
    };
    const result = await loadMLBOuterValidationTrainSource('/repo', reader);
    expect(result.ok).toBe(true);
    expect(callCount).toBe(1);
    expect(lastPath).toBe('/repo/data/mlb/inner-development/mlb-inner-development-train-artifact-v1.json');
  });
});
