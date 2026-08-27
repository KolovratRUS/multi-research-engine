import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from './mlb-real-pregame-winner-feature-manifest-v1';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  type MLBProspectiveT360FeatureCompatibilityResult,
} from './mlb-prospective-t360-capture-contract';
import {
  validateMLBFeatureVector,
  type MLBFeatureVector,
  type MLBFeatureExtractionIssue,
} from './mlb-feature-vector-contract';

/**
 * Project a 14-feature prospective candidate-003 model input vector onto the
 * committed starter compatibility policy:
 *
 *   homeStarterAvailable  -> value: 0, wasMissing: true
 *   awayStarterAvailable  -> value: 0, wasMissing: true
 *
 * All other features remain bit-for-bit identical.
 *
 * Input vector is never mutated. Output is a new immutable vector.
 */
export function applyCandidate003ProspectiveFeatureCompatibility(
  vector: unknown,
): MLBProspectiveT360FeatureCompatibilityResult {
  // 1. Authoritative vector validation
  const validation = validateMLBFeatureVector(vector);
  if (!validation.ok) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      failureCode: 'INVALID_FEATURE_VECTOR',
      issues: validation.issues,
    };
  }

  const validated = validation.value;

  // 2. Manifest binding: must be exactly the approved 14-feature vector.
  if (validated.manifestId !== MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId) {
    const issues: MLBFeatureExtractionIssue[] = [
      {
        code: 'INVALID_LITERAL',
        path: '$.manifestId',
        message: `manifestId must be ${MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.manifestId}`,
      },
    ];
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      failureCode: 'FEATURE_MANIFEST_MISMATCH',
      issues,
    };
  }

  if (validated.sport !== 'MLB') {
    const issues: MLBFeatureExtractionIssue[] = [
      {
        code: 'INVALID_LITERAL',
        path: '$.sport',
        message: 'sport must be MLB',
      },
    ];
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      failureCode: 'FEATURE_MANIFEST_MISMATCH',
      issues,
    };
  }

  if (validated.target !== 'OFFICIAL_FINAL_GAME_WINNER') {
    const issues: MLBFeatureExtractionIssue[] = [
      {
        code: 'INVALID_LITERAL',
        path: '$.target',
        message: 'target must be OFFICIAL_FINAL_GAME_WINNER',
      },
    ];
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      failureCode: 'FEATURE_MANIFEST_MISMATCH',
      issues,
    };
  }

  const expectedFeatureCount = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.length;
  const actualFeatureCount = validated.values.length;

  if (actualFeatureCount !== expectedFeatureCount) {
    const issues: MLBFeatureExtractionIssue[] = [
      {
        code: 'INVALID_ARRAY',
        path: '$.values',
        message: `Expected ${expectedFeatureCount} features, got ${actualFeatureCount}`,
      },
    ];
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      failureCode: 'FEATURE_MANIFEST_MISMATCH',
      issues,
    };
  }

  const expectedIds = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
    (f) => f.featureId,
  );

  for (let i = 0; i < expectedIds.length; i++) {
    if (validated.values[i].featureId !== expectedIds[i]) {
      const issues: MLBFeatureExtractionIssue[] = [
        {
          code: 'INVALID_LITERAL',
          path: `$.values[${i}].featureId`,
          message: `Feature ${i} must be ${expectedIds[i]}, got ${validated.values[i].featureId}`,
        },
      ];
      return {
        ok: false,
        contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
        compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
        failureCode: 'FEATURE_MANIFEST_MISMATCH',
        issues,
      };
    }
  }

  // 3. Apply starter projection on a copy of the values array.
  const projectedValues = validated.values.map((v) => {
    if (v.featureId === 'homeStarterAvailable' || v.featureId === 'awayStarterAvailable') {
      return { featureId: v.featureId, value: 0, wasMissing: true };
    }
    return v;
  });

  // 4. Build a new immutable vector.
  const projectedVector: MLBFeatureVector = {
    contractVersion: validated.contractVersion,
    sport: validated.sport,
    target: validated.target,
    manifestId: validated.manifestId,
    snapshotId: validated.snapshotId,
    gameId: validated.gameId,
    officialDate: validated.officialDate,
    dataCutoffAt: validated.dataCutoffAt,
    values: Object.freeze(projectedValues),
  };

  // 5. Final validation of the projected vector.
  const projectedValidation = validateMLBFeatureVector(projectedVector);
  if (!projectedValidation.ok) {
    return {
      ok: false,
      contractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
      compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
      failureCode: 'STARTER_COMPATIBILITY_PROJECTION_FAILED',
      issues: projectedValidation.issues,
    };
  }

  return {
    ok: true,
    value: Object.freeze(projectedValidation.value) as MLBFeatureVector,
  };
}
