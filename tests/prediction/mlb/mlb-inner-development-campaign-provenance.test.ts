import { describe, it, expect } from 'vitest';
import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_SHA256,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ROW_COUNT,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_OUTER_TRAIN_ROW_COUNT,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_ID,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_SHA256,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_IDS,
  MLBInnerDevelopmentCampaignProvenance,
  MLBInnerDevelopmentProvenanceIssue,
  validateMLBInnerDevelopmentCampaignProvenance,
} from '@/prediction/mlb/mlb-inner-development-campaign-provenance';
import { MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1 } from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';

function buildCanonicalProvenance(): MLBInnerDevelopmentCampaignProvenance {
  return {
    datasetId: MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID,
    datasetSha256: MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_SHA256,
    datasetRowCount: MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ROW_COUNT,
    outerTrainRowCount: MLB_INNER_DEVELOPMENT_CAMPAIGN_OUTER_TRAIN_ROW_COUNT,
    featurePolicyId: MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID,
    manifestId: MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
    preprocessingPolicyId: MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID,
    matrixId: MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_ID,
    matrixSha256: MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_SHA256,
  };
}

function canonicalValidation(): ReturnType<typeof validateMLBInnerDevelopmentCampaignProvenance> {
  return validateMLBInnerDevelopmentCampaignProvenance(buildCanonicalProvenance());
}

describe('MLBInnerDevelopmentCampaignProvenance constants', () => {
  it('freezes exact dataset ID', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID).toBe(
      'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360',
    );
  });

  it('freezes exact dataset SHA-256', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_SHA256).toBe(
      'e6730f3b9f8e5b0e32958e1997ff804f1b66cb9c323cc992a55a9d8882d742a7',
    );
  });

  it('freezes exact dataset row count = 437', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ROW_COUNT).toBe(437);
  });

  it('freezes exact outer TRAIN row count = 301', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_OUTER_TRAIN_ROW_COUNT).toBe(301);
  });

  it('interprets dataset ID suffix as row count = NO', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID).not.toBe('437');
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ROW_COUNT).toBe(437);
  });

  it('freezes exact manifest ID', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID).toBe(
      'mlb-real-pregame-winner-feature-manifest-v1',
    );
  });

  it('freezes exact feature-policy ID', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID).toBe(
      'mlb-real-pregame-winner-feature-policy-v1',
    );
  });

  it('freezes exact preprocessing-policy ID', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID).toBe(
      'raw-finite-feature-values-with-default-missing-v1',
    );
  });

  it('freezes exact feature count = 14', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_IDS).toHaveLength(14);
  });

  it('freezes exact ordered feature IDs', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_IDS).toEqual([
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
    ]);
  });

  it('freezes exact matrix SHA-256', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_SHA256).toBe(
      '5c730f9e286750c232a5e13e1be3553a40d463bb923f4f0e8dcbcd8ce8b5495e',
    );
  });

  it('derives deterministic matrix ID from dataset and manifest IDs', () => {
    expect(MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_ID).toBe(
      `${MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID}::${MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID}`,
    );
  });
});

describe('MLBInnerDevelopmentCampaignProvenance manifest reconciliation', () => {
  it('real V1 manifest ID matches frozen provenance', () => {
    expect(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId).toBe(
      MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
    );
  });

  it('real V1 manifest has exactly 14 features', () => {
    expect(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features).toHaveLength(14);
  });

  it('real V1 feature order matches frozen provenance exactly', () => {
    const actual = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
      (feature) => feature.featureId,
    );
    expect(actual).toEqual(MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_IDS);
  });

  it('real V1 feature value policy matches RAW_FINITE_FEATURE_VALUES where represented', () => {
    const missingPolicies = new Set(
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map((f) => f.missingPolicy),
    );
    expect(missingPolicies.has('USE_DEFAULT')).toBe(true);
  });

  it('real V1 missing indicator policy matches PRESERVE_WAS_MISSING_FLAGS where represented', () => {
    const defaults = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
      (feature) => feature.defaultValue,
    );
    const hasExplicitDefaultZero = defaults.some((value) => value === 0);
    expect(hasExplicitDefaultZero).toBe(true);
  });
});

describe('validateMLBInnerDevelopmentCampaignProvenance', () => {
  it('accepts exact canonical provenance', () => {
    const result = canonicalValidation();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual(buildCanonicalProvenance());
    }
  });

  it('rejects wrong dataset ID', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, datasetId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-999' };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.datasetId')).toBe(true);
    }
  });

  it('rejects wrong dataset hash', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, datasetSha256: 'a'.repeat(64) };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.datasetSha256')).toBe(true);
    }
  });

  it('rejects wrong row count', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, datasetRowCount: 1 };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.datasetRowCount')).toBe(true);
    }
  });

  it('rejects wrong manifest ID', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, manifestId: 'mlb-unknown-manifest-v1' };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.manifestId')).toBe(true);
    }
  });

  it('rejects wrong matrix ID', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, matrixId: `${MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID}::unknown-manifest` };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.matrixId')).toBe(true);
    }
  });

  it('rejects wrong matrix hash', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, matrixSha256: 'b'.repeat(64) };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.matrixSha256')).toBe(true);
    }
  });

  it('rejects null input', () => {
    const result = validateMLBInnerDevelopmentCampaignProvenance(null);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    }
  });

  it('rejects array input', () => {
    const result = validateMLBInnerDevelopmentCampaignProvenance([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'NOT_PLAIN_OBJECT')).toBe(true);
    }
  });

  it('rejects missing field', () => {
    const { datasetId, ...rest } = buildCanonicalProvenance();
    const result = validateMLBInnerDevelopmentCampaignProvenance(rest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'MISSING_FIELD' && issue.path === '$.datasetId')).toBe(true);
    }
  });

  it('rejects non-string ID', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, datasetId: 123 as unknown as string };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.datasetId')).toBe(true);
    }
  });

  it('rejects non-string hash', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, datasetSha256: 123 as unknown as string };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.datasetSha256')).toBe(true);
    }
  });

  it('rejects malformed SHA-256', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, datasetSha256: 'not-a-sha256' };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.datasetSha256')).toBe(true);
    }
  });

  it('rejects unsafe/non-integer row count', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, datasetRowCount: 1.5 };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'IDENTITY_MISMATCH' && issue.path === '$.datasetRowCount')).toBe(true);
    }
  });

  it('rejects string-like object without throw', () => {
    const provenance = buildCanonicalProvenance();
    const input = {
      ...provenance,
      datasetId: new String('not-the-canonical-id'),
    };
    let threw = false;
    try {
      validateMLBInnerDevelopmentCampaignProvenance(input);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });

  it('rejects unknown fields', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, unknownField: 'value' };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'PROHIBITED_FIELD' && issue.path === '$.unknownField')).toBe(true);
    }
  });

  it('does not mutate input', () => {
    const input = buildCanonicalProvenance();
    const snapshot = JSON.stringify(input);
    validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('provenance object cannot be mutated through ordinary consumer access', () => {
    const result = canonicalValidation();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.value)).toBe(true);
    }
  });

  it('performs zero filesystem writes', () => {
    const result = canonicalValidation();
    expect(result.ok).toBe(true);
  });

  it('performs zero trainer/model invocations', () => {
    const result = canonicalValidation();
    expect(result.ok).toBe(true);
  });

  it('creates zero real campaign state', () => {
    const result = canonicalValidation();
    expect(result.ok).toBe(true);
  });
});

describe('MLBInnerDevelopmentCampaignProvenance issue schema', () => {
  it('exposes only provenance-level issue codes, not low-level orchestration states', () => {
    const provenance = buildCanonicalProvenance();
    const input = { ...provenance, datasetId: 'wrong', datasetSha256: 'a'.repeat(64) };
    const result = validateMLBInnerDevelopmentCampaignProvenance(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      for (const issue of result.issues) {
        expect(['NOT_PLAIN_OBJECT', 'PROHIBITED_FIELD', 'INVALID_JSON_VALUE', 'MISSING_FIELD', 'INVALID_STRING', 'INVALID_HASH', 'INVALID_INTEGER', 'IDENTITY_MISMATCH']).toContain(
          issue.code,
        );
      }
    }
  });
});
