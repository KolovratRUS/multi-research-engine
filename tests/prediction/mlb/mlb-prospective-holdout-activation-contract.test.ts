import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_COHORT_REGISTRATION_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
  validateMLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivation,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';

function buildValidActivation(overrides: Record<string, unknown> = {}): MLBProspectiveHoldoutActivation {
  const base = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-1',
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    validationBoundaryOfficialDate: '2026-09-10',
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
    validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
    testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
    gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  };
  return { ...base, ...overrides } as MLBProspectiveHoldoutActivation;
}

async function createTempRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'mlb-prospective-holdout-activation-store-test-'));
}

describe('mlb-prospective-holdout-activation-contract', () => {
  describe('valid synthetic activation', () => {
    it('passes validation', () => {
      const activation = buildValidActivation();
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(true);
    });
  });

  describe('boundary date', () => {
    it('rejects invalid format', () => {
      const activation = buildValidActivation({ validationBoundaryOfficialDate: 'not-a-date' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'INVALID_DATE')).toBe(true);
      }
    });

    it('rejects impossible calendar date', () => {
      const activation = buildValidActivation({ validationBoundaryOfficialDate: '2026-02-30' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'INVALID_DATE')).toBe(true);
      }
    });

    it('rejects timestamp instead of date', () => {
      const activation = buildValidActivation({
        validationBoundaryOfficialDate: '2026-09-10T00:00:00Z',
      });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'INVALID_DATE')).toBe(true);
      }
    });

    it('rejects empty string', () => {
      const activation = buildValidActivation({ validationBoundaryOfficialDate: '' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'INVALID_DATE')).toBe(true);
      }
    });
  });

  describe('fixed counts', () => {
    it('rejects validation target 66', () => {
      const activation = buildValidActivation({ validationTargetCount: 66 });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects validation target 68', () => {
      const activation = buildValidActivation({ validationTargetCount: 68 });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects test target 68', () => {
      const activation = buildValidActivation({ testTargetCount: 68 });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects test target 70', () => {
      const activation = buildValidActivation({ testTargetCount: 70 });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });
  });

  describe('scientific identity tampering', () => {
    it('rejects wrong protocol ID', () => {
      const activation = buildValidActivation({ protocolId: 'wrong-protocol' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects wrong candidate recipe ID', () => {
      const activation = buildValidActivation({ candidateRecipeId: 'wrong-recipe' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects wrong candidate fingerprint', () => {
      const activation = buildValidActivation({ candidateFingerprint: 'wrong-fingerprint' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects wrong feature manifest ID', () => {
      const activation = buildValidActivation({ featureManifestId: 'wrong-manifest' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects wrong feature policy ID', () => {
      const activation = buildValidActivation({ featurePolicyId: 'wrong-policy' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects wrong preprocessing policy ID', () => {
      const activation = buildValidActivation({ preprocessingPolicyId: 'wrong-preprocessing' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects wrong capture contract version', () => {
      const activation = buildValidActivation({ captureContractVersion: 'wrong-capture' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects wrong compatibility layer ID', () => {
      const activation = buildValidActivation({ compatibilityLayerId: 'wrong-compat' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects wrong evidence artifact contract version', () => {
      const activation = buildValidActivation({ evidenceArtifactContractVersion: 'wrong-evidence' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    it('rejects wrong evidence store version', () => {
      const activation = buildValidActivation({ evidenceStoreVersion: 'wrong-store' });
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
    });

    describe('game identity binding', () => {
      it('accepts valid PRE2 binding versions', () => {
        const activation = buildValidActivation();
        const result = validateMLBProspectiveHoldoutActivation(activation);
        expect(result.ok).toBe(true);
      });

      it('rejects wrong binding contract version', () => {
        const activation = buildValidActivation({
          gameIdentityBindingContractVersion: 'wrong-binding-contract',
        });
        const result = validateMLBProspectiveHoldoutActivation(activation);
        expect(result.ok).toBe(false);
      });

      it('rejects wrong binding store version', () => {
        const activation = buildValidActivation({
          gameIdentityBindingStoreVersion: 'wrong-binding-store',
        });
        const result = validateMLBProspectiveHoldoutActivation(activation);
        expect(result.ok).toBe(false);
      });

      it('rejects swapped binding contract/store versions', () => {
        const activation = buildValidActivation({
          gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
          gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
        });
        const result = validateMLBProspectiveHoldoutActivation(activation);
        expect(result.ok).toBe(false);
      });
    });
  });

  describe('strict own-key validation', () => {
    it('rejects unknown own keys', () => {
      const activation = { ...buildValidActivation(), unknownField: 'value' };
      const result = validateMLBProspectiveHoldoutActivation(activation);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.code === 'PROHIBITED_FIELD')).toBe(true);
      }
    });

    it('rejects result inputs', () => {
      const tampered = buildValidActivation() as Record<string, unknown>;
      tampered.winner = 'home';
      const result = validateMLBProspectiveHoldoutActivation(tampered);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.some((i) => i.path === '$.winner')).toBe(true);
      }
    });
  });
});
