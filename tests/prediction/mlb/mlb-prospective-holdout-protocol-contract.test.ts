import { describe, expect, it } from 'vitest';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL,
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_SCIENTIFIC_CUTOFF_POLICY_ID,
  MLB_CAPTURE_VALIDITY_POLICY_ID,
  MLB_POST_T360_MODEL_INFORMATION_PROHIBITED_POLICY_ID,
  MLB_PROVENANCE_REWRITE_PROHIBITED_POLICY_ID,
  MLB_ACTUAL_DATA_CUTOFF_LTE_T360_REQUIRED_POLICY_ID,
  MLB_PROSPECTIVE_HOLDOUT_INSUFFICIENT_TEST_COUNT_REASON,
  MLB_PROSPECTIVE_HOLDOUT_SELECTION_EXCLUSION_REASONS,
  MLB_PROSPECTIVE_HOLDOUT_BOUNDARY_TYPE,
  MLB_PROSPECTIVE_HOLDOUT_STABLE_SELECTION_ORDER,
  MLB_PROSPECTIVE_HOLDOUT_FAIL_CLOSED_REASON,
  MLB_CANDIDATE_003_STARTER_COMPATIBILITY_POLICY_ID,
  type MLBProspectiveHoldoutActivationSkeleton,
  validateMLBProspectiveHoldoutProtocol,
  validateMLBProspectiveHoldoutActivationSkeleton,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
} from '@/prediction/mlb/mlb-inner-development-train-artifact';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-runtime-provenance';
import { MLB_PRETEST_GATE_POLICY_ID } from '@/prediction/mlb/mlb-pretest-validation-reference-contract';

function buildValidProtocol(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    regularization: { kind: 'L2', strength: 0.1 },
    optimizer: {
      solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
      learningRate: 0.01,
      maxIterations: 5000,
      tolerance: 0.0001,
    },
    featureChangesAllowed: false,
    hyperparameterChangesAllowed: false,
    candidate004Allowed: false,
    validationTuningAllowed: false,
    trainArtifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
    trainSourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    trainArtifactSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    trainArtifactByteLength: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
    trainRowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
    trainFirstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
    trainLastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    scientificCutoffMinutes: 360,
    scientificCutoffPolicyId: MLB_SCIENTIFIC_CUTOFF_POLICY_ID,
    captureValidityPolicyId: MLB_CAPTURE_VALIDITY_POLICY_ID,
    postT360ModelInformationProhibitedPolicyId: MLB_POST_T360_MODEL_INFORMATION_PROHIBITED_POLICY_ID,
    provenanceRewriteProhibitedPolicyId: MLB_PROVENANCE_REWRITE_PROHIBITED_POLICY_ID,
    actualDataCutoffLteT360RequiredPolicyId: MLB_ACTUAL_DATA_CUTOFF_LTE_T360_REQUIRED_POLICY_ID,
    validationTargetRowCount: 67,
    testTargetRowCount: 69,
    insufficientTestCount: MLB_PROSPECTIVE_HOLDOUT_INSUFFICIENT_TEST_COUNT_REASON,
    stableSelectionOrder: MLB_PROSPECTIVE_HOLDOUT_STABLE_SELECTION_ORDER,
    boundaryType: MLB_PROSPECTIVE_HOLDOUT_BOUNDARY_TYPE,
    selectionExclusionReasons: [...MLB_PROSPECTIVE_HOLDOUT_SELECTION_EXCLUSION_REASONS],
    resultDependentSelectionAllowed: false,
    insufficientValidationCount: MLB_PROSPECTIVE_HOLDOUT_FAIL_CLOSED_REASON,
    automaticTestAfterValidationPass: false,
    gatePolicyId: MLB_PRETEST_GATE_POLICY_ID,
    candidate003StarterCompatibilityPolicyId: MLB_CANDIDATE_003_STARTER_COMPATIBILITY_POLICY_ID,
    starterCompatibilityHomeValue: 0,
    starterCompatibilityHomeWasMissing: true,
    starterCompatibilityAwayValue: 0,
    starterCompatibilityAwayWasMissing: true,
    labelTarget: 'OFFICIAL_FINAL_GAME_WINNER',
    labelEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    oldHoldoutRetirementReason: 'HISTORICAL_PAYLOAD_UNAVAILABLE_AND_NOT_REPRODUCIBLE',
    ...overrides,
  };
}

function buildValidActivation(): MLBProspectiveHoldoutActivationSkeleton {
  return {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'mlb-v1-candidate-003-prospective-activation-001',
    activatedAt: '2026-04-20T00:00:00.000Z',
    candidateSelectionStartAt: '2026-04-20T00:00:00.000Z',
    validationBoundaryOfficialDate: '2026-04-24',
    earliestCandidateScientificCutoffAt: '2026-04-21T00:00:00.000Z',
    optionalScheduleSnapshotIdentity: null,
  };
}

describe('mlb-prospective-holdout-protocol-contract', () => {
  describe('validateMLBProspectiveHoldoutProtocol', () => {
    it('1. canonical valid protocol passes', () => {
      const result = validateMLBProspectiveHoldoutProtocol(buildValidProtocol());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.protocolId).toBe(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID);
        expect(result.value.candidateRecipeId).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID);
      }
    });

    it('2. contractVersion mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ contractVersion: 'mlb-prospective-holdout-protocol-v2' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.contractVersion')).toBe(true);
      }
    });

    it('3. protocolId mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ protocolId: 'mlb-v1-candidate-003-prospective-holdout-v2' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.protocolId')).toBe(true);
      }
    });

    it('4. candidateRecipeId mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ candidateRecipeId: 'mlb-v1-inner-candidate-004' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.candidateRecipeId')).toBe(true);
      }
    });

    it('5. candidateFingerprint mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ candidateFingerprint: '0000000000000000000000000000000000000000000000000000000000000000' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.candidateFingerprint')).toBe(true);
      }
    });

    it('6. regularization kind mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ regularization: { kind: 'L1', strength: 0.1 } }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.regularization.kind')).toBe(true);
      }
    });

    it('7. regularization strength mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ regularization: { kind: 'L2', strength: 0.2 } }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.regularization.strength')).toBe(true);
      }
    });

    it('8. optimizer solver mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({
          optimizer: { solver: 'SOME_OTHER_SOLVER', learningRate: 0.01, maxIterations: 5000, tolerance: 0.0001 },
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.optimizer.solver')).toBe(true);
      }
    });

    it('9. optimizer learningRate mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({
          optimizer: { solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1', learningRate: 0.02, maxIterations: 5000, tolerance: 0.0001 },
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.optimizer.learningRate')).toBe(true);
      }
    });

    it('10. optimizer maxIterations mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({
          optimizer: { solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1', learningRate: 0.01, maxIterations: 1000, tolerance: 0.0001 },
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.optimizer.maxIterations')).toBe(true);
      }
    });

    it('11. optimizer tolerance mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({
          optimizer: { solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1', learningRate: 0.01, maxIterations: 5000, tolerance: 0.001 },
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.optimizer.tolerance')).toBe(true);
      }
    });

    it('12. TRAIN artifact ID mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ trainArtifactId: 'mlb-historical-labelled-dataset-v1-2026-04-01-2026-04-23-360::mlb-real-pregame-winner-feature-manifest-v1::train-only-fake' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.trainArtifactId')).toBe(true);
      }
    });

    it('13. TRAIN SHA mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ trainArtifactSha256: '0000000000000000000000000000000000000000000000000000000000000000' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.trainArtifactSha256')).toBe(true);
      }
    });

    it('14. TRAIN byte length mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ trainArtifactByteLength: 1 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.trainArtifactByteLength')).toBe(true);
      }
    });

    it('15. TRAIN row count mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ trainRowCount: 300 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.trainRowCount')).toBe(true);
      }
    });

    it('16. manifest mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v2' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.featureManifestId')).toBe(true);
      }
    });

    it('17. feature-policy/preprocessing swap rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({
          featurePolicyId: 'raw-finite-feature-values-with-default-missing-v1',
          preprocessingPolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.featurePolicyId')).toBe(true);
        expect(result.issues.some((issue) => issue.path === '$.preprocessingPolicyId')).toBe(true);
      }
    });

    it('17b. preprocessing-policy/feature swap rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({
          featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
          preprocessingPolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.preprocessingPolicyId')).toBe(true);
      }
    });

    it('18. scientific cutoff 359 rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ scientificCutoffMinutes: 359 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.scientificCutoffMinutes')).toBe(true);
      }
    });

    it('19. scientific cutoff 361 rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ scientificCutoffMinutes: 361 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.scientificCutoffMinutes')).toBe(true);
      }
    });

    it('20. validation N != 67 rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ validationTargetRowCount: 66 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.validationTargetRowCount')).toBe(true);
      }
    });

    it('21. test N != 69 rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ testTargetRowCount: 70 }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.testTargetRowCount')).toBe(true);
      }
    });

    it('22. stable ordering mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ stableSelectionOrder: 'gamePk_ASC_scheduledStartAt_ASC' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.stableSelectionOrder')).toBe(true);
      }
    });

    it('23. boundary type mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ boundaryType: 'SOME_OTHER_BOUNDARY' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.boundaryType')).toBe(true);
      }
    });

    it('24. candidate004 allowed=true rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ candidate004Allowed: true }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.candidate004Allowed')).toBe(true);
      }
    });

    it('25. validation tuning allowed=true rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ validationTuningAllowed: true }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.validationTuningAllowed')).toBe(true);
      }
    });

    it('26. automatic TEST=true rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ automaticTestAfterValidationPass: true }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.automaticTestAfterValidationPass')).toBe(true);
      }
    });

    it('27. starter compatibility value mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({
          starterCompatibilityHomeValue: 1,
          starterCompatibilityHomeWasMissing: false,
          starterCompatibilityAwayValue: 1,
          starterCompatibilityAwayWasMissing: false,
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.starterCompatibilityHomeValue')).toBe(true);
        expect(result.issues.some((issue) => issue.path === '$.starterCompatibilityHomeWasMissing')).toBe(true);
        expect(result.issues.some((issue) => issue.path === '$.starterCompatibilityAwayValue')).toBe(true);
        expect(result.issues.some((issue) => issue.path === '$.starterCompatibilityAwayWasMissing')).toBe(true);
      }
    });

    it('28. result-dependent selection rule rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ resultDependentSelectionAllowed: true }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.resultDependentSelectionAllowed')).toBe(true);
      }
    });

    it('29. market/odds selection concept rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ stableSelectionOrder: 'market_odds_probability_DESC' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.stableSelectionOrder')).toBe(true);
      }
    });

    it('30. unknown enumerable own key rejected', () => {
      const input = buildValidProtocol();
      (input as Record<string, unknown>).unknownField = 'x';
      const result = validateMLBProspectiveHoldoutProtocol(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.unknownField')).toBe(true);
      }
    });

    it('31. unknown non-enumerable own key rejected', () => {
      const input = buildValidProtocol();
      Object.defineProperty(input, 'hiddenField', {
        value: 'x',
        enumerable: false,
        writable: true,
        configurable: true,
      });
      const result = validateMLBProspectiveHoldoutProtocol(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.hiddenField')).toBe(true);
      }
    });

    it('32. symbol own key rejected with symbol-specific path', () => {
      const input = buildValidProtocol();
      const sym = Symbol.for('sym');
      (input as Record<symbol, unknown>)[sym] = 'x';
      const result = validateMLBProspectiveHoldoutProtocol(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const symbolPath = `$[Symbol(${sym.description ?? sym.toString()})]`;
        expect(result.issues.some((issue) => issue.path === symbolPath && issue.code === 'PROHIBITED_FIELD')).toBe(true);
        expect(result.issues.every((issue) => issue.path !== '$.sym')).toBe(true);
      }
    });

    it('33. accessor rejected', () => {
      const input = buildValidProtocol();
      Object.defineProperty(input, 'protocolId', {
        get() { return 'x'; },
        enumerable: true,
        configurable: true,
      });
      const result = validateMLBProspectiveHoldoutProtocol(input);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.protocolId' && issue.code === 'INVALID_JSON_VALUE')).toBe(true);
      }
    });

    it('34. non-plain object rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(null);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$' && issue.code === 'NOT_PLAIN_OBJECT')).toBe(true);
      }
    });

    it('35. insufficient test count rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ insufficientTestCount: 'INCOMPLETE_FAIL_CLOSED' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.insufficientTestCount')).toBe(true);
      }
    });

    it('36. selection exclusion reasons mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({
          selectionExclusionReasons: [
            'CANCELLED_BEFORE_VALID_CAPTURE',
            'POSTPONED_OUTSIDE_FROZEN_TEMPORAL_SIDE',
            'SOURCE_OUTAGE_BEFORE_CUTOFF',
            'CAPTURE_NOT_COMPLETED_BY_SCIENTIFIC_CUTOFF',
            'SNAPSHOT_CONTRACT_INVALID_BEFORE_OUTCOME',
            'REQUIRED_MODEL_SOURCE_POST_CUTOFF',
            'EXTRA_REASON',
          ],
        }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.selectionExclusionReasons[6]')).toBe(true);
      }
    });

    it('37. T-360 post cutoff policy ID mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ postT360ModelInformationProhibitedPolicyId: 'POST_T360_MODEL_INFORMATION_ALLOWED_V1' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.postT360ModelInformationProhibitedPolicyId')).toBe(true);
      }
    });

    it('38. provenance rewrite policy ID mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ provenanceRewriteProhibitedPolicyId: 'PROVENANCE_REWRITE_ALLOWED_V1' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.provenanceRewriteProhibitedPolicyId')).toBe(true);
      }
    });

    it('39. actual data cutoff policy ID mutation rejected', () => {
      const result = validateMLBProspectiveHoldoutProtocol(
        buildValidProtocol({ actualDataCutoffLteT360RequiredPolicyId: 'ACTUAL_DATA_CUTOFF_AFTER_T360_ALLOWED_V1' }),
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.actualDataCutoffLteT360RequiredPolicyId')).toBe(true);
      }
    });
  });

  describe('validateMLBProspectiveHoldoutActivationSkeleton', () => {
    it('40. canonical valid activation passes', () => {
      const result = validateMLBProspectiveHoldoutActivationSkeleton(buildValidActivation());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.protocolId).toBe(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID);
      }
    });

    it('41. activation after earliest cutoff rejected', () => {
      const result = validateMLBProspectiveHoldoutActivationSkeleton({
        ...buildValidActivation(),
        activatedAt: '2026-05-01T00:00:00.000Z',
        earliestCandidateScientificCutoffAt: '2026-04-21T00:00:00.000Z',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.activatedAt' && issue.code === 'INVALID_TIMESTAMP_ORDER')).toBe(true);
      }
    });

    it('42. candidateSelectionStartAt after earliest cutoff rejected', () => {
      const result = validateMLBProspectiveHoldoutActivationSkeleton({
        ...buildValidActivation(),
        candidateSelectionStartAt: '2026-05-01T00:00:00.000Z',
        earliestCandidateScientificCutoffAt: '2026-04-21T00:00:00.000Z',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.candidateSelectionStartAt' && issue.code === 'INVALID_TIMESTAMP_ORDER')).toBe(true);
      }
    });

    it('43. invalid boundary date rejected', () => {
      const result = validateMLBProspectiveHoldoutActivationSkeleton({
        ...buildValidActivation(),
        validationBoundaryOfficialDate: '04-24-2026',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.validationBoundaryOfficialDate' && issue.code === 'INVALID_DATE')).toBe(true);
      }
    });

    it('44. wrong protocol ID in activation rejected', () => {
      const result = validateMLBProspectiveHoldoutActivationSkeleton({
        ...buildValidActivation(),
        protocolId: 'mlb-v1-candidate-003-prospective-holdout-v2',
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((issue) => issue.path === '$.protocolId' && issue.code === 'IDENTITY_MISMATCH')).toBe(true);
      }
    });
  });

  it('45. frozen protocol is immutable', () => {
    expect(Object.isFrozen(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL)).toBe(true);
    expect(typeof MLB_PROSPECTIVE_HOLDOUT_PROTOCOL).toBe('object');
  });

  it('46. protocol id and version are immutable literals', () => {
    expect(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID).toBe('mlb-v1-candidate-003-prospective-holdout-v1');
    expect(MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_CONTRACT_VERSION).toBe('mlb-prospective-holdout-protocol-v1');
  });
});
