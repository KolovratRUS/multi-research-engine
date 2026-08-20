import { describe, expect, it } from 'vitest';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
  MLBInnerDevelopmentTrainArtifact,
  type MLBInnerDevelopmentTrainArtifactIssue,
  validateMLBInnerDevelopmentTrainArtifact,
  buildMLBInnerDevelopmentTrainArtifact,
  serializeMLBInnerDevelopmentTrainArtifact,
  computeMLBInnerDevelopmentTrainArtifactSHA256,
  hashMLBInnerDevelopmentTrainArtifact,
} from '@/prediction/mlb/mlb-inner-development-train-artifact';
import {
  validateMLBTrainOnlyInnerRowCollection,
  type MLBOuterTrainRow,
  type MLBTrainOnlyInnerRowCollection,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLB_FEATURE_VECTOR_CONTRACT_VERSION,
  type MLBFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';

const FROZEN_DATA_CUTOFF = '2026-04-10T00:00:00Z';

function buildValidVector(
  exampleId: string,
  officialDate: string,
  overrides: Record<string, unknown> = {},
): MLBFeatureVector {
  return {
    contractVersion: MLB_FEATURE_VECTOR_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
    snapshotId: `snapshot-${exampleId}`,
    gameId: exampleId,
    officialDate,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    values: [{ featureId: 'f-1', value: 1, wasMissing: false }],
    ...overrides,
  };
}

function buildValidRow(
  exampleId: string,
  officialDate: string,
  targetValue: 0 | 1,
): MLBOuterTrainRow {
  return {
    exampleId,
    split: 'TRAIN',
    vector: buildValidVector(exampleId, officialDate, {}),
    targetValue,
  };
}

function buildSyntheticTrainCollection(): MLBTrainOnlyInnerRowCollection {
  const rows: MLBOuterTrainRow[] = [];
  let exampleCounter = 1;

  for (let day = 1; day <= 23; day++) {
    const officialDate = `2026-04-${String(day).padStart(2, '0')}`;
    const rowsForDay = Math.min(15, 301 - rows.length + 1);
    for (let i = 0; i < rowsForDay && rows.length < 301; i++) {
      const exampleId = `syn-train-${String(exampleCounter).padStart(3, '0')}`;
      const targetValue = (i % 2 === 0) ? 1 : 0;
      rows.push(buildValidRow(exampleId, officialDate, targetValue));
      exampleCounter++;
    }
    if (rows.length >= 301) break;
  }

  return buildCollectionFromRows(rows);
}

function buildCollectionFromRows(rows: readonly MLBOuterTrainRow[]): MLBTrainOnlyInnerRowCollection {
  const homeWinCount = rows.filter((r) => r.targetValue === 1).length;
  const awayWinCount = rows.filter((r) => r.targetValue === 0).length;

  return {
    contractVersion: 'mlb-train-only-inner-row-collection-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    matrixId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID,
    manifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
    datasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    rowCount: rows.length,
    homeWinCount,
    awayWinCount,
    rows,
  };
}

function buildCanonicalArtifact(overrides: Record<string, unknown> = {}): MLBInnerDevelopmentTrainArtifact {
  const rowCollection = buildSyntheticTrainCollection();
  const artifact = {
    artifactContractVersion: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
    artifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
    sourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    featureManifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
    featurePolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
    preprocessingPolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
    split: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
    rowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
    firstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
    lastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
    foldPlanId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
    rowCollection,
    ...overrides,
  };
  const result = validateMLBInnerDevelopmentTrainArtifact(artifact);
  if (!result.ok) {
    throw new Error(`Invalid artifact: ${result.issues.map((i) => `${i.code}: ${i.message}`).join(', ')}`);
  }
  return result.value;
}

function buildRawArtifact(overrides: Record<string, unknown> = {}) {
  const rowCollection = buildSyntheticTrainCollection();
  return {
    artifactContractVersion: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
    artifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
    sourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    featureManifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
    featurePolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
    preprocessingPolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
    split: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
    rowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
    firstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
    lastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
    foldPlanId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
    rowCollection,
    ...overrides,
  };
}

// Contract constants
describe('MLBInnerDevelopmentTrainArtifact contract constants', () => {
  it('1: exact artifact contract version', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION).toBe('mlb-inner-development-train-artifact-v1');
  });

  it('2: exact deterministic artifact ID', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID).toBe(
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360::mlb-real-pregame-winner-feature-manifest-v1::train-only',
    );
  });

  it('3: exact source dataset ID', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID).toBe(
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360',
    );
  });

  it('3b: exact source matrix ID', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID).toBe(
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360::mlb-real-pregame-winner-feature-manifest-v1',
    );
  });

  it('4: exact manifest ID', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID).toBe('mlb-real-pregame-winner-feature-manifest-v1');
  });

  it('5: exact feature policy ID', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID).toBe('mlb-real-pregame-winner-feature-policy-v1');
  });

  it('6: exact preprocessing policy ID', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID).toBe('raw-finite-feature-values-with-default-missing-v1');
  });

  it('7: exact split TRAIN', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT).toBe('TRAIN');
  });

  it('8: exact row count 301', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT).toBe(301);
  });

  it('9: exact first date 2026-04-01', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE).toBe('2026-04-01');
  });

  it('10: exact last date 2026-04-23', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE).toBe('2026-04-23');
  });

  it('11: exact fold-plan identity', () => {
    expect(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID).toBe('mlb-train-only-inner-fold-plan-v1');
  });

  it('12: no createdAt wrapper field', () => {
    const artifact = buildCanonicalArtifact();
    expect(Object.prototype.hasOwnProperty.call(artifact, 'createdAt')).toBe(false);
  });

  it('13: no artifactSha256 payload field', () => {
    const artifact = buildCanonicalArtifact();
    expect(Object.prototype.hasOwnProperty.call(artifact, 'artifactSha256')).toBe(false);
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    expect(serialized).not.toContain('artifactSha256');
  });
});

// Builder
describe('buildMLBInnerDevelopmentTrainArtifact', () => {
  it('14: valid synthetic 301-row TRAIN collection accepted', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const artifact = buildMLBInnerDevelopmentTrainArtifact(rowCollection);
    expect(artifact.rowCount).toBe(301);
    expect(artifact.split).toBe('TRAIN');
  });

  it('15: frozen metadata cannot be overridden', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = {
      artifactContractVersion: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
      artifactId: 'wrong-id',
      sourceDatasetId: 'wrong-dataset',
      featureManifestId: 'wrong-manifest',
      featurePolicyId: 'wrong-policy',
      preprocessingPolicyId: 'wrong-preprocessing',
      split: 'TRAIN',
      rowCount: 301,
      firstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
      lastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
      foldPlanId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
      rowCollection,
    };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL')).toBe(true);
    }
  });

  it('16: input not mutated', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const originalRowCount = rowCollection.rowCount;
    const originalRowsLength = rowCollection.rows.length;
    buildMLBInnerDevelopmentTrainArtifact(rowCollection);
    expect(rowCollection.rowCount).toBe(originalRowCount);
    expect(rowCollection.rows.length).toBe(originalRowsLength);
  });

  it('17: resulting artifact immutable', () => {
    const artifact = buildCanonicalArtifact();
    expect(Object.isFrozen(artifact)).toBe(true);
    expect(Object.isFrozen(artifact.rowCollection)).toBe(true);
    expect(Object.isFrozen(artifact.rowCollection.rows)).toBe(true);
    expect(Object.isFrozen(artifact.rowCollection.rows[0])).toBe(true);
    expect(Object.isFrozen(artifact.rowCollection.rows[0].vector)).toBe(true);
    expect(Object.isFrozen(artifact.rowCollection.rows[0].vector.values)).toBe(true);
  });
});

// Validation
describe('validateMLBInnerDevelopmentTrainArtifact', () => {
  it('18: canonical artifact accepted', () => {
    const artifact = buildCanonicalArtifact();
    const result = validateMLBInnerDevelopmentTrainArtifact(artifact);
    expect(result.ok).toBe(true);
  });

  it('19: null fails', () => {
    const result = validateMLBInnerDevelopmentTrainArtifact(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    }
  });

  it('20: array fails', () => {
    const result = validateMLBInnerDevelopmentTrainArtifact([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    }
  });

  it('21: primitive fails', () => {
    const result = validateMLBInnerDevelopmentTrainArtifact('string');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    }
  });

  it('22: missing field fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const artifact = buildCanonicalArtifact({ rowCollection });
    const bad = { ...artifact };
    delete (bad as Record<string, unknown>).sourceDatasetId;
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'MISSING_FIELD' && i.path === '$.sourceDatasetId')).toBe(true);
    }
  });

  it('23: unknown field fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = {
      ...buildCanonicalArtifact({ rowCollection }),
      unknownField: 'bad',
    };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'UNKNOWN_FIELD' && i.path === '$.unknownField')).toBe(true);
    }
  });

  it('24: wrong contract version fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), artifactContractVersion: 'wrong-version' };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.artifactContractVersion')).toBe(true);
    }
  });

  it('25: wrong artifact ID fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), artifactId: 'wrong-id' };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.artifactId')).toBe(true);
    }
  });

  it('26: wrong dataset ID fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), sourceDatasetId: 'wrong-dataset' };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.sourceDatasetId')).toBe(true);
    }
  });

  it('27: wrong manifest ID fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), featureManifestId: 'wrong-manifest' };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.featureManifestId')).toBe(true);
    }
  });

  it('28: wrong feature policy fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), featurePolicyId: 'wrong-policy' };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.featurePolicyId')).toBe(true);
    }
  });

  it('29: wrong preprocessing policy fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), preprocessingPolicyId: 'wrong-preprocessing' };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.preprocessingPolicyId')).toBe(true);
    }
  });

  it('30: wrong split fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), split: 'VALIDATION' };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.split')).toBe(true);
    }
  });

  it('31: rowCount != 301 fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), rowCount: 300 };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.rowCount')).toBe(true);
    }
  });

  it('32: actual row length != 301 fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const shortRows = rowCollection.rows.slice(0, 300);
    const badCollection = buildCollectionFromRows(shortRows);
    const bad = buildRawArtifact({ rowCollection: badCollection, rowCount: 300 });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'COUNT_MISMATCH')).toBe(true);
    }
  });

  it('33: VALIDATION row fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const rowsWithValidation = rowCollection.rows.map((r, idx) =>
      idx === 0 ? { ...r, split: 'VALIDATION' as const, exampleId: 'val-row' } : r,
    );
    const badCollection = buildCollectionFromRows(rowsWithValidation as unknown as MLBOuterTrainRow[]);
    const bad = buildRawArtifact({ rowCollection: badCollection });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'ROW_COLLECTION_INVALID')).toBe(true);
    }
  });

  it('34: TEST row fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const rowsWithTest = rowCollection.rows.map((r, idx) =>
      idx === 0 ? { ...r, split: 'TEST' as const, exampleId: 'test-row' } : r,
    );
    const badCollection = buildCollectionFromRows(rowsWithTest as unknown as MLBOuterTrainRow[]);
    const bad = buildRawArtifact({ rowCollection: badCollection });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'ROW_COLLECTION_INVALID')).toBe(true);
    }
  });

  it('35: row outside first/last date fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const badRows = rowCollection.rows.map((r, idx) =>
      idx === 0 ? { ...r, vector: { ...r.vector, officialDate: '2026-04-30' }, exampleId: 'bad-date' } : r,
    );
    const badCollection = buildCollectionFromRows(badRows);
    const bad = buildRawArtifact({ rowCollection: badCollection });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'ROW_COLLECTION_INVALID')).toBe(true);
    }
  });

  it('36: wrong fold-plan identity fails', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), foldPlanId: 'wrong-fold-plan' };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.foldPlanId')).toBe(true);
    }
  });

  it('37: malformed nested row collection fails without throw', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), rowCollection: { not: 'valid' } };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'ROW_COLLECTION_INVALID')).toBe(true);
    }
  });

  it('38: string-like object coercion rejected', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = { ...buildCanonicalArtifact({ rowCollection }), sourceDatasetId: new String('mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360') };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_STRING')).toBe(true);
    }
  });

  it('39: inherited property does not satisfy required own field', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const parent = {
      sourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    };
    const child = Object.create(parent);
    child.artifactContractVersion = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION;
    child.artifactId = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID;
    child.featureManifestId = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID;
    child.featurePolicyId = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID;
    child.preprocessingPolicyId = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID;
    child.split = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT;
    child.rowCount = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT;
    child.firstOfficialDate = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE;
    child.lastOfficialDate = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE;
    child.foldPlanId = MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID;
    child.rowCollection = rowCollection;
    const result = validateMLBInnerDevelopmentTrainArtifact(child);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    }
  });

  it('40: accessor/getter field handled fail-closed', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const accessor = {
      ...buildCanonicalArtifact({ rowCollection }),
      get artifactContractVersion() {
        return MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION;
      },
    };
    const result = validateMLBInnerDevelopmentTrainArtifact(accessor);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_JSON_VALUE')).toBe(true);
    }
  });

  it('40b: artifact full-corpus sourceDatasetId rejected', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const bad = {
      ...buildCanonicalArtifact({ rowCollection }),
      sourceDatasetId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360',
    };
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.sourceDatasetId')).toBe(true);
    }
  });

  it('40c: rowCollection full-corpus datasetId rejected', () => {
    const rows = buildSyntheticTrainCollection().rows;
    const badCollection = buildCollectionFromRows(rows);
    (badCollection as unknown as Record<string, unknown>).datasetId =
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360';
    const bad = buildRawArtifact({ rowCollection: badCollection });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.rowCollection.datasetId')).toBe(true);
    }
  });

  it('40d: rowCollection full-corpus matrixId rejected', () => {
    const rows = buildSyntheticTrainCollection().rows;
    const badCollection = buildCollectionFromRows(rows);
    (badCollection as unknown as Record<string, unknown>).matrixId =
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1';
    const bad = buildRawArtifact({ rowCollection: badCollection });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.rowCollection.matrixId')).toBe(true);
    }
  });

  it('40e: arbitrary non-empty rowCollection matrixId rejected', () => {
    const rows = buildSyntheticTrainCollection().rows;
    const badCollection = buildCollectionFromRows(rows);
    (badCollection as unknown as Record<string, unknown>).matrixId = 'arbitrary-matrix-id';
    const bad = buildRawArtifact({ rowCollection: badCollection });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'INVALID_LITERAL' && i.path === '$.rowCollection.matrixId')).toBe(true);
    }
  });

  it('40f: correct TRAIN-source matrixId accepted', () => {
    const rows = buildSyntheticTrainCollection().rows;
    const goodCollection = buildCollectionFromRows(rows);
    const artifact = buildMLBInnerDevelopmentTrainArtifact(goodCollection);
    expect(artifact.rowCollection.matrixId).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID);
  });

  it('40g: serializer does not rewrite invalid datasetId', () => {
    const rows = buildSyntheticTrainCollection().rows;
    const badCollection = buildCollectionFromRows(rows);
    (badCollection as unknown as Record<string, unknown>).datasetId =
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360';
    const bad = buildRawArtifact({ rowCollection: badCollection });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const datasetIssue = result.issues.find((i) => i.path === '$.rowCollection.datasetId');
      expect(datasetIssue).toBeDefined();
      expect(datasetIssue?.message).toContain('mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360');
    }
  });

  it('40h: serializer does not rewrite invalid matrixId', () => {
    const rows = buildSyntheticTrainCollection().rows;
    const badCollection = buildCollectionFromRows(rows);
    (badCollection as unknown as Record<string, unknown>).matrixId = 'arbitrary-matrix-id';
    const bad = buildRawArtifact({ rowCollection: badCollection });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const matrixIssue = result.issues.find((i) => i.path === '$.rowCollection.matrixId');
      expect(matrixIssue).toBeDefined();
      expect(matrixIssue?.message).toContain(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID);
    }
  });

  it('40i: builder does not rewrite invalid datasetId', () => {
    const rows = buildSyntheticTrainCollection().rows;
    const badCollection = buildCollectionFromRows(rows);
    (badCollection as unknown as Record<string, unknown>).datasetId =
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360';
    expect(() => buildMLBInnerDevelopmentTrainArtifact(badCollection)).toThrow();
  });

  it('40j: builder does not rewrite invalid matrixId', () => {
    const rows = buildSyntheticTrainCollection().rows;
    const badCollection = buildCollectionFromRows(rows);
    (badCollection as unknown as Record<string, unknown>).matrixId = 'arbitrary-matrix-id';
    expect(() => buildMLBInnerDevelopmentTrainArtifact(badCollection)).toThrow();
  });

  it('40k: full-lineage ID absent from valid sealed artifact bytes', () => {
    const artifact = buildCanonicalArtifact();
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    expect(serialized).not.toContain('mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360');
    expect(serialized).not.toContain(
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1',
    );
  });
});

// Structural isolation
describe('MLBInnerDevelopmentTrainArtifact structural isolation', () => {
  it('41: accepted artifact contains no fullDataset', () => {
    const artifact = buildCanonicalArtifact();
    expect(Object.prototype.hasOwnProperty.call(artifact, 'fullDataset')).toBe(false);
  });

  it('42: no fullMatrix', () => {
    const artifact = buildCanonicalArtifact();
    expect(Object.prototype.hasOwnProperty.call(artifact, 'fullMatrix')).toBe(false);
  });

  it('43: no outerValidationRows', () => {
    const artifact = buildCanonicalArtifact();
    expect(Object.prototype.hasOwnProperty.call(artifact, 'outerValidationRows')).toBe(false);
  });

  it('44: no testRows', () => {
    const artifact = buildCanonicalArtifact();
    expect(Object.prototype.hasOwnProperty.call(artifact, 'testRows')).toBe(false);
  });

  it('45: serialized output contains no TEST/VALIDATION container', () => {
    const artifact = buildCanonicalArtifact();
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    expect(serialized).not.toContain('VALIDATION');
    expect(serialized).not.toContain('TEST');
    const parsed = JSON.parse(serialized) as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(parsed, 'validationRows')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'testRows')).toBe(false);
  });
});

// Serialization
describe('serializeMLBInnerDevelopmentTrainArtifact', () => {
  it('46: exact pretty JSON', () => {
    const artifact = buildCanonicalArtifact();
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const parsed = JSON.parse(serialized);
    expect(parsed.artifactContractVersion).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION);
    expect(parsed.rowCount).toBe(301);
  });

  it('47: exactly one LF trailing newline', () => {
    const artifact = buildCanonicalArtifact();
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    expect(serialized.endsWith('\n')).toBe(true);
    expect(serialized.endsWith('\r\n')).toBe(false);
  });

  it('48: no BOM', () => {
    const artifact = buildCanonicalArtifact();
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const bytes = new TextEncoder().encode(serialized);
    expect(bytes[0]).toBe(0x7b); // '{'
    expect(bytes[0]).not.toBe(0xef);
  });

  it('49: repeated serialization byte-identical', () => {
    const artifact = buildCanonicalArtifact();
    const first = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const second = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    expect(first).toBe(second);
    expect(new TextEncoder().encode(first)).toEqual(new TextEncoder().encode(second));
  });

  it('50: input property insertion order cannot alter canonical bytes', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const artifact1Result = validateMLBInnerDevelopmentTrainArtifact({
      artifactContractVersion: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
      artifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
      sourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
      featureManifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
      featurePolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
      preprocessingPolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
      split: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
      rowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
      firstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
      lastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
      foldPlanId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
      rowCollection,
    });
    expect(artifact1Result.ok).toBe(true);
    if (!artifact1Result.ok) throw new Error('Expected valid artifact');
    const artifact1 = artifact1Result.value;

    const artifact2Result = validateMLBInnerDevelopmentTrainArtifact({
      artifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
      sourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
      featureManifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
      featurePolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
      preprocessingPolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
      split: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
      rowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
      firstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
      lastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
      foldPlanId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
      rowCollection,
      artifactContractVersion: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
    });
    expect(artifact2Result.ok).toBe(true);
    if (!artifact2Result.ok) throw new Error('Expected valid artifact');
    const artifact2 = artifact2Result.value;

    expect(serializeMLBInnerDevelopmentTrainArtifact(artifact1)).toBe(
      serializeMLBInnerDevelopmentTrainArtifact(artifact2),
    );
  });

  it('51: nested canonical projection stable', () => {
    const artifact = buildCanonicalArtifact();
    const serialized1 = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const parsed = JSON.parse(serialized1) as Record<string, unknown>;
    const parsedRowCollection = parsed.rowCollection as Record<string, unknown>;
    const firstVector = (parsedRowCollection.rows as Record<string, unknown>[])[0].vector as Record<string, unknown>;
    const firstValue = (firstVector.values as Record<string, unknown>[])[0];
    expect(Object.keys(firstVector)[0]).toBe('contractVersion');
    expect(Object.keys(firstValue)[0]).toBe('featureId');
  });

  it('52: row order validated rather than silently reordered', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const outOfOrderRows = [...rowCollection.rows].reverse();
    const badCollection = buildCollectionFromRows(outOfOrderRows);
    const bad = buildRawArtifact({ rowCollection: badCollection });
    const result = validateMLBInnerDevelopmentTrainArtifact(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((i) => i.code === 'ROW_COLLECTION_INVALID')).toBe(true);
    }
  });
});

// Hash
describe('MLBInnerDevelopmentTrainArtifact hash', () => {
  it('53: exact known synthetic SHA fixture', () => {
    const artifact = buildCanonicalArtifact();
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const bytes = new TextEncoder().encode(serialized);
    const hash = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it('54: lowercase 64-char hex', () => {
    const artifact = buildCanonicalArtifact();
    const hash = hashMLBInnerDevelopmentTrainArtifact(artifact);
    expect(hash).toHaveLength(64);
    expect(hash === hash.toLowerCase()).toBe(true);
  });

  it('55: same bytes -> same hash', () => {
    const artifact = buildCanonicalArtifact();
    const hash1 = hashMLBInnerDevelopmentTrainArtifact(artifact);
    const hash2 = hashMLBInnerDevelopmentTrainArtifact(artifact);
    expect(hash1).toBe(hash2);
  });

  it('56: changed byte -> different hash', () => {
    const artifact = buildCanonicalArtifact();
    const hash1 = hashMLBInnerDevelopmentTrainArtifact(artifact);
    const mutatedArtifact = { ...artifact, rowCount: 300 } as unknown as MLBInnerDevelopmentTrainArtifact;
    const hash2 = hashMLBInnerDevelopmentTrainArtifact(mutatedArtifact);
    expect(hash1).not.toBe(hash2);
  });

  it('57: CRLF-vs-LF bytes hash differently', () => {
    const artifact = buildCanonicalArtifact();
    const lf = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const crlf = lf.replace(/\n/g, '\r\n');
    expect(computeMLBInnerDevelopmentTrainArtifactSHA256(new TextEncoder().encode(lf))).not.toBe(
      computeMLBInnerDevelopmentTrainArtifactSHA256(new TextEncoder().encode(crlf)),
    );
  });

  it('58: removing final newline changes hash', () => {
    const artifact = buildCanonicalArtifact();
    const lf = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const noNewline = lf.slice(0, -1);
    expect(computeMLBInnerDevelopmentTrainArtifactSHA256(new TextEncoder().encode(lf))).not.toBe(
      computeMLBInnerDevelopmentTrainArtifactSHA256(new TextEncoder().encode(noNewline)),
    );
  });

  it('59: hash helper performs no transformation', () => {
    const artifact = buildCanonicalArtifact();
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const expected = computeMLBInnerDevelopmentTrainArtifactSHA256(new TextEncoder().encode(serialized));
    expect(hashMLBInnerDevelopmentTrainArtifact(artifact)).toBe(expected);
  });

  it('60: artifact hash convenience helper matches serialize->UTF8->SHA exactly', () => {
    const artifact = buildCanonicalArtifact();
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    const bytes = new TextEncoder().encode(serialized);
    const expected = computeMLBInnerDevelopmentTrainArtifactSHA256(bytes);
    expect(hashMLBInnerDevelopmentTrainArtifact(artifact)).toBe(expected);
  });
});

// Safety
describe('MLBInnerDevelopmentTrainArtifact safety', () => {
  it('61: zero filesystem reads', () => {
    expect(() => {
      buildCanonicalArtifact();
      serializeMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
      hashMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
    }).not.toThrow();
  });

  it('62: zero filesystem writes', () => {
    expect(() => {
      buildCanonicalArtifact();
      serializeMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
      hashMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
    }).not.toThrow();
  });

  it('63: zero API calls', () => {
    expect(() => {
      buildCanonicalArtifact();
      serializeMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
      hashMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
    }).not.toThrow();
  });

  it('64: zero trainer invocations', () => {
    expect(() => {
      buildCanonicalArtifact();
      serializeMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
      hashMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
    }).not.toThrow();
  });

  it('65: zero model fits', () => {
    expect(() => {
      buildCanonicalArtifact();
      serializeMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
      hashMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
    }).not.toThrow();
  });

  it('66: zero predictions', () => {
    expect(() => {
      buildCanonicalArtifact();
      serializeMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
      hashMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
    }).not.toThrow();
  });

  it('67: zero campaign state', () => {
    expect(() => {
      buildCanonicalArtifact();
      serializeMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
      hashMLBInnerDevelopmentTrainArtifact(buildCanonicalArtifact());
    }).not.toThrow();
  });

  it('68: zero outer VALIDATION access', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const artifact = buildCanonicalArtifact({ rowCollection });
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    expect(serialized).not.toContain('VALIDATION');
  });

  it('69: zero TEST access', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const artifact = buildCanonicalArtifact({ rowCollection });
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    expect(serialized).not.toContain('TEST');
  });

  it('70: odds/market inputs NONE', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const artifact = buildCanonicalArtifact({ rowCollection });
    const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
    expect(serialized).not.toContain('odds');
    expect(serialized).not.toContain('moneyline');
    expect(serialized).not.toContain('sportsbook');
  });
});

// Immutability deep-freeze verification
describe('MLBInnerDevelopmentTrainArtifact deep immutability', () => {
  it('validates nested vectors are frozen', () => {
    const artifact = buildCanonicalArtifact();
    expect(Object.isFrozen(artifact.rowCollection.rows[0].vector)).toBe(true);
    expect(Object.isFrozen(artifact.rowCollection.rows[0].vector.values)).toBe(true);
  });

  it('builder does not mutate input row collection', () => {
    const rowCollection = buildSyntheticTrainCollection();
    const originalRows = rowCollection.rows;
    const originalRowCollection = rowCollection;
    buildMLBInnerDevelopmentTrainArtifact(rowCollection);
    expect(rowCollection.rows).toBe(originalRows);
    expect(rowCollection).toBe(originalRowCollection);
  });
});
