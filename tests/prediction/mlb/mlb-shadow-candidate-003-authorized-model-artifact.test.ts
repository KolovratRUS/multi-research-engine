/* -------------------------------------------------------------------------- */
/*  Functional tests for L5E2X-P5B-C2 — candidate-003 authorized model artifact */
/*  Proves the embedded model is structurally valid, produces the exact        */
/*  canonical fingerprint, and all attestation/provenance values are exact.    */
/* -------------------------------------------------------------------------- */

import { describe, expect, it } from 'vitest';
import {
  MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
  computeMLBShadowModelFingerprint,
  verifyMLBShadowCandidate003AuthoritativeModel,
} from '@/prediction/mlb/mlb-shadow-model-fingerprint';
import {
  MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
  type MLBDeterministicLogisticRegressionModel,
  type MLBModelCoefficient,
  validateMLBDeterministicLogisticRegressionModel,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-runtime-provenance';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
} from '@/prediction/mlb/mlb-inner-development-train-artifact';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
} from '@/prediction/mlb/mlb-outer-validation-promotion-contract';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
  getMLBShadowCandidate003AuthorizedModelArtifact,
  type MLBShadowCandidate003AuthorizedModelArtifact,
  validateMLBShadowCandidate003AuthorizedModelArtifact,
} from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';

/* -------------------------------------------------------------------------- */
/*  Deep-clone helper — JSON round-trip yields a fully mutable plain object    */
/* -------------------------------------------------------------------------- */

function deepCloneArtifact(): unknown {
  return JSON.parse(
    JSON.stringify(getMLBShadowCandidate003AuthorizedModelArtifact()),
  );
}

/* -------------------------------------------------------------------------- */
/*  Expected exact values (must match the recovered model identity)             */
/* -------------------------------------------------------------------------- */

const EXPECTED_CONTRACT_VERSION =
  'mlb-shadow-candidate-003-authorized-model-artifact-v1';
const EXPECTED_MODEL_ID = 'mlb-v1-inner-candidate-003::plan-v1::model-v1';
const EXPECTED_PLAN_ID = 'mlb-v1-inner-candidate-003::plan-v1';
const EXPECTED_DATASET_ID =
  'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360';
const EXPECTED_MATRIX_ID =
  'mlb-historical-labelled-dataset-v1-2026-04-01-2026-05-03-360::mlb-real-pregame-winner-feature-manifest-v1';
const EXPECTED_MANIFEST_ID = 'mlb-real-pregame-winner-feature-manifest-v1';
const EXPECTED_ALGORITHM = 'L2_LOGISTIC_REGRESSION_BINARY_V1';
const EXPECTED_TRAINING_ROW_COUNT = 301;
const EXPECTED_ITERATIONS_COMPLETED = 528;
const EXPECTED_FINAL_TRAINING_OBJECTIVE = 0.6833056399549484;
const EXPECTED_INTERCEPT = 0.004266984963800175;

const EXPECTED_CANONICAL_FINGERPRINT =
  '547fac8e2319a8ed33d1263a7e5feb4729aeecab553484cbc3218992528803cf';
const EXPECTED_TRAIN_SHA256 =
  '426c01c097c24fb9dffbbcbb5ec3fb1d026e8edc24454f33f13b660719612454';
const EXPECTED_RECIPE_ID = 'mlb-v1-inner-candidate-003';
const EXPECTED_RECIPE_FINGERPRINT =
  'ce35df51cdf38ed9bf91aa2fb78871443f259c963d8c2700e8b6fe5d960a95bc';
const EXPECTED_PROMOTION_EVALUATION_ID =
  'mlb-v1-outer-validation-promotion-evaluation-003';

const EXPECTED_MANIFEST_FINGERPRINT =
  '8d5c2077c52359a429ddfed074ebbb7541df40fb5bfec9d468dd4ac76706e101';

const EXPECTED_FEATURE_IDS: readonly string[] = [
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

const EXPECTED_COEFFICIENTS: readonly MLBModelCoefficient[] = [
  { featureId: 'awayBullpenExtraInningGames', valueCoefficient: 0.006410621443824374, missingIndicatorCoefficient: 0 },
  { featureId: 'awayBullpenGamesInPrevious3Days', valueCoefficient: 0.062184989740699394, missingIndicatorCoefficient: 0 },
  { featureId: 'awayRunsAllowedPerGame', valueCoefficient: -0.04580417731791942, missingIndicatorCoefficient: 0 },
  { featureId: 'awayRunsScoredPerGame', valueCoefficient: -0.0968889941229032, missingIndicatorCoefficient: 0 },
  { featureId: 'awayStarterAvailable', valueCoefficient: 0, missingIndicatorCoefficient: 0.0031406735952362866 },
  { featureId: 'awayWinRate', valueCoefficient: -0.024022941488343195, missingIndicatorCoefficient: 0 },
  { featureId: 'doubleHeaderGameNumber', valueCoefficient: 0.011859202638432608, missingIndicatorCoefficient: 0.004308202131016179 },
  { featureId: 'homeBullpenExtraInningGames', valueCoefficient: -0.09612414124359463, missingIndicatorCoefficient: 0 },
  { featureId: 'homeBullpenGamesInPrevious3Days', valueCoefficient: 0.016996463333255517, missingIndicatorCoefficient: 0 },
  { featureId: 'homeRunsAllowedPerGame', valueCoefficient: 0.014800079647428618, missingIndicatorCoefficient: 0 },
  { featureId: 'homeRunsScoredPerGame', valueCoefficient: 0.08618179714588282, missingIndicatorCoefficient: 0 },
  { featureId: 'homeStarterAvailable', valueCoefficient: 0, missingIndicatorCoefficient: 0.0031406735952362866 },
  { featureId: 'homeWinRate', valueCoefficient: 0.004308399717451391, missingIndicatorCoefficient: 0 },
  { featureId: 'scheduledInnings', valueCoefficient: 0.02826606235712657, missingIndicatorCoefficient: 0 },
];

/* -------------------------------------------------------------------------- */
/*  Deep-mutable mirror for mutation tests                                    */
/* -------------------------------------------------------------------------- */

type MutableCoefficient = {
  featureId: string;
  valueCoefficient: number;
  missingIndicatorCoefficient: number;
};

type MutableModel = {
  contractVersion: string;
  sport: string;
  target: string;
  targetEncoding: string;
  modelId: string;
  planId: string;
  matrixId: string;
  configId: string;
  manifestId: string;
  datasetId: string;
  algorithm: string;
  featureIds: string[];
  intercept: number;
  coefficients: MutableCoefficient[];
  trainingRowCount: number;
  iterationsCompleted: number;
  converged: boolean;
  finalTrainingObjective: number;
};

type MutableAttestation = {
  candidateRecipeId: string;
  candidateRecipeFingerprint: string;
  modelCanonicalFingerprint: string;
  trainArtifactSha256: string;
  trainRowCount: number;
  manifestId: string;
  manifestFingerprint: string;
  outerValidationPromotionEvaluationId: string;
};

type MutableArtifact = {
  contractVersion: string;
  model: MutableModel;
  attestation: MutableAttestation;
};

function cloneArtifact(): MutableArtifact {
  return deepCloneArtifact() as unknown as MutableArtifact;
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-shadow-candidate-003-authorized-model-artifact', () => {
  const artifact = getMLBShadowCandidate003AuthorizedModelArtifact();
  const model = artifact.model;
  const attestation = artifact.attestation;

  /* ------------------------------------------------------ */
  /*  Contract version                                      */
  /* ------------------------------------------------------ */

  describe('contract version', () => {
    it('contractVersion exact', () => {
      expect(artifact.contractVersion).toBe(EXPECTED_CONTRACT_VERSION);
    });

    it('exported constant matches', () => {
      expect(MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION).toBe(
        EXPECTED_CONTRACT_VERSION,
      );
    });
  });

  /* ------------------------------------------------------ */
  /*  Getter                                                */
  /* ------------------------------------------------------ */

  describe('getter', () => {
    it('returns the artifact', () => {
      const result = getMLBShadowCandidate003AuthorizedModelArtifact();
      expect(result).toBeDefined();
      expect(result.contractVersion).toBe(EXPECTED_CONTRACT_VERSION);
      expect(result.model).toBeDefined();
      expect(result.attestation).toBeDefined();
    });

    it('returns the same reference on repeated calls (frozen singleton)', () => {
      const a1 = getMLBShadowCandidate003AuthorizedModelArtifact();
      const a2 = getMLBShadowCandidate003AuthorizedModelArtifact();
      expect(a1).toBe(a2);
    });
  });

  /* ------------------------------------------------------ */
  /*  Validator acceptance                                  */
  /* ------------------------------------------------------ */

  describe('validator accepts getter artifact', () => {
    it('validator accepts the getter artifact', () => {
      const result = validateMLBShadowCandidate003AuthorizedModelArtifact(artifact);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.contractVersion).toBe(EXPECTED_CONTRACT_VERSION);
      }
    });

    it('model validator accepts the embedded model', () => {
      const result = validateMLBDeterministicLogisticRegressionModel(model);
      expect(result.ok).toBe(true);
    });
  });

  /* ------------------------------------------------------ */
  /*  Canonical model fingerprint                           */
  /* ------------------------------------------------------ */

  describe('canonical model fingerprint', () => {
    it('canonical model fingerprint exact', () => {
      const fp = computeMLBShadowModelFingerprint(model);
      expect(fp).toBe(EXPECTED_CANONICAL_FINGERPRINT);
    });

    it('authoritative model gate = true', () => {
      expect(verifyMLBShadowCandidate003AuthoritativeModel(model)).toBe(true);
    });
  });

  /* ------------------------------------------------------ */
  /*  Model identity fields                                 */
  /* ------------------------------------------------------ */

  describe('model identity', () => {
    it('modelId exact', () => {
      expect(model.modelId).toBe(EXPECTED_MODEL_ID);
    });

    it('planId exact', () => {
      expect(model.planId).toBe(EXPECTED_PLAN_ID);
    });

    it('configId exact', () => {
      expect(model.configId).toBe(MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID);
    });

    it('datasetId exact', () => {
      expect(model.datasetId).toBe(MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID);
    });

    it('matrixId exact', () => {
      expect(model.matrixId).toBe(MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID);
    });

    it('manifestId exact', () => {
      expect(model.manifestId).toBe(MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID);
    });

    it('algorithm exact', () => {
      expect(model.algorithm).toBe(EXPECTED_ALGORITHM);
    });

    it('model contractVersion is the frozen model contract', () => {
      expect(model.contractVersion).toBe(
        MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
      );
    });

    it('sport exact', () => {
      expect(model.sport).toBe('MLB');
    });

    it('target exact', () => {
      expect(model.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
    });

    it('targetEncoding exact', () => {
      expect(model.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
    });
  });

  /* ------------------------------------------------------ */
  /*  Training metadata                                     */
  /* ------------------------------------------------------ */

  describe('training metadata', () => {
    it('trainingRowCount = 301', () => {
      expect(model.trainingRowCount).toBe(EXPECTED_TRAINING_ROW_COUNT);
    });

    it('iterationsCompleted = 528', () => {
      expect(model.iterationsCompleted).toBe(EXPECTED_ITERATIONS_COMPLETED);
    });

    it('converged = true', () => {
      expect(model.converged).toBe(true);
    });

    it('finalTrainingObjective exact', () => {
      expect(model.finalTrainingObjective).toBe(EXPECTED_FINAL_TRAINING_OBJECTIVE);
    });

    it('intercept exact', () => {
      expect(model.intercept).toBe(EXPECTED_INTERCEPT);
    });
  });

  /* ------------------------------------------------------ */
  /*  Feature IDs match frozen manifest                     */
  /* ------------------------------------------------------ */

  describe('feature IDs match frozen manifest', () => {
    it('featureIds match manifest feature order', () => {
      const manifestFeatureIds = MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
        (f) => f.featureId,
      );
      expect(model.featureIds).toEqual(manifestFeatureIds);
    });

    it('featureIds match expected order', () => {
      expect(model.featureIds).toEqual(EXPECTED_FEATURE_IDS);
    });

    it('manifest fingerprint constant is correct', () => {
      expect(MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT).toBe(
        EXPECTED_MANIFEST_FINGERPRINT,
      );
    });
  });

  /* ------------------------------------------------------ */
  /*  Coefficients                                            */
  /* ------------------------------------------------------ */

  describe('coefficients', () => {
    it('coefficients array length = 14', () => {
      expect(model.coefficients).toHaveLength(14);
    });

    it('coefficients match expected values exactly', () => {
      expect(model.coefficients).toEqual(EXPECTED_COEFFICIENTS);
    });

    it('coefficient featureId matches featureIds ordering', () => {
      for (let i = 0; i < model.coefficients.length; i++) {
        expect(model.coefficients[i]!.featureId).toBe(model.featureIds[i]);
      }
    });
  });

  /* ------------------------------------------------------ */
  /*  Attestation fields                                    */
  /* ------------------------------------------------------ */

  describe('attestation', () => {
    it('candidate recipe ID exact', () => {
      expect(attestation.candidateRecipeId).toBe(EXPECTED_RECIPE_ID);
    });

    it('candidate recipe ID matches production constant', () => {
      expect(attestation.candidateRecipeId).toBe(
        MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
      );
    });

    it('candidate recipe fingerprint exact', () => {
      expect(attestation.candidateRecipeFingerprint).toBe(
        EXPECTED_RECIPE_FINGERPRINT,
      );
    });

    it('candidate recipe fingerprint matches production constant', () => {
      expect(attestation.candidateRecipeFingerprint).toBe(
        MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
      );
    });

    it('modelCanonicalFingerprint exact', () => {
      expect(attestation.modelCanonicalFingerprint).toBe(
        EXPECTED_CANONICAL_FINGERPRINT,
      );
    });

    it('modelCanonicalFingerprint matches production constant', () => {
      expect(attestation.modelCanonicalFingerprint).toBe(
        MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
      );
    });

    it('TRAIN SHA exact', () => {
      expect(attestation.trainArtifactSha256).toBe(EXPECTED_TRAIN_SHA256);
    });

    it('TRAIN SHA matches production constant', () => {
      expect(attestation.trainArtifactSha256).toBe(
        MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
      );
    });

    it('TRAIN row count exact', () => {
      expect(attestation.trainRowCount).toBe(EXPECTED_TRAINING_ROW_COUNT);
    });

    it('TRAIN row count matches production constant', () => {
      expect(attestation.trainRowCount).toBe(
        MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
      );
    });

    it('manifest ID exact', () => {
      expect(attestation.manifestId).toBe(EXPECTED_MANIFEST_ID);
    });

    it('manifest ID matches production constant', () => {
      expect(attestation.manifestId).toBe(
        MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
      );
    });

    it('manifest fingerprint exact', () => {
      expect(attestation.manifestFingerprint).toBe(
        EXPECTED_MANIFEST_FINGERPRINT,
      );
    });

    it('manifest fingerprint matches production constant', () => {
      expect(attestation.manifestFingerprint).toBe(
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
      );
    });

    it('promotion evaluation ID exact', () => {
      expect(attestation.outerValidationPromotionEvaluationId).toBe(
        EXPECTED_PROMOTION_EVALUATION_ID,
      );
    });

    it('promotion evaluation ID matches production constant', () => {
      expect(attestation.outerValidationPromotionEvaluationId).toBe(
        MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID,
      );
    });
  });

  /* ------------------------------------------------------ */
  /*  Cross-checks                                          */
  /* ------------------------------------------------------ */

  describe('cross-checks', () => {
    it('model.manifestId == attestation.manifestId', () => {
      expect(model.manifestId).toBe(attestation.manifestId);
    });

    it('model.trainingRowCount == attestation.trainRowCount', () => {
      expect(model.trainingRowCount).toBe(attestation.trainRowCount);
    });

    it('attestation.modelCanonicalFingerprint == computeMLBShadowModelFingerprint(model)', () => {
      expect(computeMLBShadowModelFingerprint(model)).toBe(
        attestation.modelCanonicalFingerprint,
      );
    });

    it('attestation.modelCanonicalFingerprint == canonical constant', () => {
      expect(attestation.modelCanonicalFingerprint).toBe(
        MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
      );
    });

    it('verifyMLBShadowCandidate003AuthoritativeModel(model) == true', () => {
      expect(verifyMLBShadowCandidate003AuthoritativeModel(model)).toBe(true);
    });
  });

  /* ------------------------------------------------------ */
  /*  Deep immutability                                     */
  /* ------------------------------------------------------ */

  describe('deep immutability', () => {
    it('root artifact frozen', () => {
      expect(Object.isFrozen(artifact)).toBe(true);
    });

    it('model frozen', () => {
      expect(Object.isFrozen(model)).toBe(true);
    });

    it('featureIds frozen', () => {
      expect(Object.isFrozen(model.featureIds)).toBe(true);
    });

    it('coefficients array frozen', () => {
      expect(Object.isFrozen(model.coefficients)).toBe(true);
    });

    it('every coefficient object frozen', () => {
      for (const coeff of model.coefficients) {
        expect(Object.isFrozen(coeff)).toBe(true);
      }
    });

    it('attestation frozen', () => {
      expect(Object.isFrozen(attestation)).toBe(true);
    });
  });

  /* ------------------------------------------------------ */
  /*  Mutation attempts (must not alter values)             */
  /* ------------------------------------------------------ */

  describe('mutation attempts', () => {
    it('attempting to set root property throws', () => {
      expect(() => {
        (artifact as Record<string, unknown>).newField = 'evil';
      }).toThrow();
    });

    it('attempting to set model property throws', () => {
      expect(() => {
        (model as Record<string, unknown>).intercept = 999;
      }).toThrow();
    });

    it('attempting to assign to featureIds element throws', () => {
      expect(() => {
        Object.assign(model.featureIds, { 0: 'mutated' });
      }).toThrow();
    });

    it('attempting to push to featureIds throws', () => {
      expect(() => {
        (model.featureIds as unknown as string[]).push('extra');
      }).toThrow();
    });

    it('attempting to set coefficient property throws', () => {
      expect(() => {
        (model.coefficients[0] as Record<string, unknown>).valueCoefficient = 999;
      }).toThrow();
    });

    it('attempting to push to coefficients throws', () => {
      expect(() => {
        (model.coefficients as unknown as MLBModelCoefficient[]).push({
          featureId: 'x',
          valueCoefficient: 1,
          missingIndicatorCoefficient: 0,
        });
      }).toThrow();
    });

    it('attempting to set attestation property throws', () => {
      expect(() => {
        (attestation as Record<string, unknown>).trainRowCount = 999;
      }).toThrow();
    });

    it('intercept is unchanged after mutation attempt', () => {
      const originalIntercept = model.intercept;
      expect(() => {
        (model as Record<string, unknown>).intercept = 999;
      }).toThrow();
      expect(model.intercept).toBe(originalIntercept);
    });

    it('first coefficient valueCoefficient is unchanged after mutation attempt', () => {
      const original = model.coefficients[0]!.valueCoefficient;
      expect(() => {
        (model.coefficients[0] as Record<string, unknown>).valueCoefficient = 999;
      }).toThrow();
      expect(model.coefficients[0]!.valueCoefficient).toBe(original);
    });

    it('attestation candidateRecipeId is unchanged after mutation attempt', () => {
      const original = attestation.candidateRecipeId;
      expect(() => {
        (attestation as Record<string, unknown>).candidateRecipeId = 'evil';
      }).toThrow();
      expect(attestation.candidateRecipeId).toBe(original);
    });
  });

  /* ------------------------------------------------------ */
  /*  Negative validation — reject mutations               */
  /*  At least one mutation from every major category.      */
  /* ------------------------------------------------------ */

  describe('negative validation — reject mutations', () => {
    function expectReject(mutate: (a: MutableArtifact) => void): void {
      const copy = cloneArtifact();
      mutate(copy);
      const result = validateMLBShadowCandidate003AuthorizedModelArtifact(copy);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues.length).toBeGreaterThan(0);
      }
    }

    /* --- top-level --- */
    it('top-level unknown field', () => {
      expectReject((a) => {
        (a as Record<string, unknown>).unknownTopLevel = 'x';
      });
    });

    it('attestation unknown field', () => {
      expectReject((a) => {
        (a.attestation as Record<string, unknown>).unknownField = 'x';
      });
    });

    it('wrong contractVersion', () => {
      expectReject((a) => {
        a.contractVersion = 'wrong-version';
      });
    });

    it('missing model field', () => {
      expectReject((a) => {
        delete (a as Record<string, unknown>).model;
      });
    });

    it('missing attestation field', () => {
      expectReject((a) => {
        delete (a as Record<string, unknown>).attestation;
      });
    });

    it('non-object input', () => {
      const result = validateMLBShadowCandidate003AuthorizedModelArtifact('not-an-object');
      expect(result.ok).toBe(false);
    });

    it('null input', () => {
      const result = validateMLBShadowCandidate003AuthorizedModelArtifact(null);
      expect(result.ok).toBe(false);
    });

    /* --- attestation fields --- */
    it('wrong candidateRecipeId', () => {
      expectReject((a) => {
        a.attestation.candidateRecipeId = 'mlb-v1-inner-candidate-099';
      });
    });

    it('wrong candidateRecipeFingerprint', () => {
      expectReject((a) => {
        a.attestation.candidateRecipeFingerprint = '0'.repeat(64);
      });
    });

    it('wrong modelCanonicalFingerprint', () => {
      expectReject((a) => {
        a.attestation.modelCanonicalFingerprint = '0'.repeat(64);
      });
    });

    it('wrong trainArtifactSha256', () => {
      expectReject((a) => {
        a.attestation.trainArtifactSha256 = '0'.repeat(64);
      });
    });

    it('wrong trainRowCount', () => {
      expectReject((a) => {
        a.attestation.trainRowCount = 999;
      });
    });

    it('wrong manifestId (attestation)', () => {
      expectReject((a) => {
        a.attestation.manifestId = 'wrong-manifest-id';
      });
    });

    it('wrong manifestFingerprint', () => {
      expectReject((a) => {
        a.attestation.manifestFingerprint = '0'.repeat(64);
      });
    });

    it('wrong outerValidationPromotionEvaluationId', () => {
      expectReject((a) => {
        a.attestation.outerValidationPromotionEvaluationId = 'wrong-eval-id';
      });
    });

    /* --- model identity --- */
    it('wrong modelId', () => {
      expectReject((a) => {
        a.model.modelId = 'mlb-v1-inner-candidate-099::plan-v1::model-v1';
      });
    });

    it('wrong planId', () => {
      expectReject((a) => {
        a.model.planId = 'mlb-v1-inner-candidate-099::plan-v1';
      });
    });

    it('wrong configId', () => {
      expectReject((a) => {
        a.model.configId = 'mlb-v1-inner-candidate-099';
      });
    });

    it('wrong datasetId', () => {
      expectReject((a) => {
        a.model.datasetId = 'wrong-dataset-id';
      });
    });

    it('wrong matrixId', () => {
      expectReject((a) => {
        a.model.matrixId = 'wrong-matrix-id';
      });
    });

    it('wrong model manifestId', () => {
      expectReject((a) => {
        a.model.manifestId = 'wrong-model-manifest-id';
      });
    });

    it('wrong algorithm', () => {
      expectReject((a) => {
        a.model.algorithm = 'L1_LOGISTIC_REGRESSION_BINARY_V1';
      });
    });

    /* --- feature ordering --- */
    it('wrong feature ordering (swapped featureIds)', () => {
      expectReject((a) => {
        const ids = [...a.model.featureIds];
        [ids[0], ids[1]] = [ids[1], ids[0]];
        a.model.featureIds = ids;
      });
    });

    it('wrong feature ordering (extra feature)', () => {
      expectReject((a) => {
        a.model.featureIds = [...a.model.featureIds, 'extraFeature'];
      });
    });

    /* --- intercept --- */
    it('wrong intercept', () => {
      expectReject((a) => {
        a.model.intercept = 0.999;
      });
    });

    /* --- coefficient value --- */
    it('wrong coefficient value (valueCoefficient)', () => {
      expectReject((a) => {
        a.model.coefficients[0].valueCoefficient = 0.999;
      });
    });

    it('wrong coefficient value (missingIndicatorCoefficient)', () => {
      expectReject((a) => {
        a.model.coefficients[0].missingIndicatorCoefficient = 0.999;
      });
    });

    it('wrong coefficient featureId', () => {
      expectReject((a) => {
        a.model.coefficients[0].featureId = 'wrongFeature';
      });
    });

    /* --- training metadata --- */
    it('wrong trainingRowCount (model)', () => {
      expectReject((a) => {
        a.model.trainingRowCount = 999;
      });
    });

    it('wrong iterationsCompleted', () => {
      expectReject((a) => {
        a.model.iterationsCompleted = 1;
      });
    });

    it('wrong converged', () => {
      expectReject((a) => {
        a.model.converged = false;
      });
    });

    it('wrong finalTrainingObjective', () => {
      expectReject((a) => {
        a.model.finalTrainingObjective = 0.001;
      });
    });
  });

  /* ------------------------------------------------------ */
  /*  Performance firewall — no metrics in attestation      */
  /* ------------------------------------------------------ */

  describe('performance firewall', () => {
    it('attestation has no performance metric fields', () => {
      const forbiddenKeys = [
        'accuracy', 'logLoss', 'brierScore', 'rocAuc', 'calibration',
        'correctCount', 'incorrectCount', 'validation', 'test', 'historical',
      ];
      const attestationKeys = Object.keys(attestation);
      for (const key of forbiddenKeys) {
        expect(attestationKeys).not.toContain(key);
      }
    });

    it('attestation has exactly 8 fields', () => {
      expect(Object.keys(attestation)).toHaveLength(8);
    });

    it('artifact has exactly 3 top-level fields', () => {
      expect(Object.keys(artifact)).toHaveLength(3);
    });
  });
});
