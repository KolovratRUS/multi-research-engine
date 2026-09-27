/* -------------------------------------------------------------------------- */
/*  Frozen model fingerprint for shadow monitoring (L5E2Q)                    */
/* -------------------------------------------------------------------------- */

/**
 * Pure, deterministic model fingerprinting for the MLB shadow monitoring
 * candidate-003 model.
 *
 * Properties:
 *  - Uses the production type MLBDeterministicLogisticRegressionModel and
 *    its validator validateMLBDeterministicLogisticRegressionModel.
 *  - Builds a canonical payload array (NOT an object) with a fixed element
 *    order — no recursive key sorting.
 *  - Rejects non-finite numbers and negative zero before hashing.
 *  - Returns lowercase hex SHA-256 of the UTF-8 JSON serialization.
 *  - The verifier fails closed unless the computed hash exactly equals the
 *    frozen authoritative candidate-003 hash.
 *
 * No I/O, no Date.now, no Math.random, no network.
 */

import { createHash } from 'node:crypto';
import {
  type MLBDeterministicLogisticRegressionModel,
  validateMLBDeterministicLogisticRegressionModel,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';

/* -------------------------------------------------------------------------- */
/*  Frozen constants                                                          */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_MODEL_FINGERPRINT_CONTRACT_VERSION =
  'mlb-shadow-model-fingerprint-v1' as const;

/**
 * The exact SHA-256 of the canonical payload for the frozen
 * candidate-003 model. Any model whose fingerprint does not equal this
 * value is rejected.
 */
export const MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256 =
  '547fac8e2319a8ed33d1263a7e5feb4729aeecab553484cbc3218992528803cf';

/* -------------------------------------------------------------------------- */
/*  Non-finite / negative-zero guard                                          */
/* -------------------------------------------------------------------------- */

/**
 * Recursively walks the canonical payload (arrays and primitives only —
 * NO plain objects appear in the canonical payload) and rejects any
 * non-finite number or negative zero.
 *
 * This is defense-in-depth: validateMLBDeterministicLogisticRegressionModel
 * already rejects these, but the fingerprint layer must independently
 * guarantee that no non-finite or negative-zero value can enter the hash.
 */
function assertAllNumbersFiniteAndNonNegativeZero(
  value: unknown,
  path: string,
): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error(
        `Non-finite number at ${path}: ${String(value)}`,
      );
    }
    if (Object.is(value, -0)) {
      throw new Error(`Negative zero at ${path}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertAllNumbersFiniteAndNonNegativeZero(value[i], `${path}[${i}]`);
    }
    return;
  }
  // Strings and booleans are acceptable — no numeric constraint to enforce.
}

/* -------------------------------------------------------------------------- */
/*  Canonical fingerprint computation                                         */
/* -------------------------------------------------------------------------- */

/**
 * Computes the SHA-256 fingerprint of a frozen candidate model.
 *
 * The canonical payload is an ordered array (NOT an object), so
 * JSON.stringify produces deterministic output without any key sorting.
 *
 * @throws Error if the model fails validation, contains non-finite numbers,
 *   contains negative zero, or otherwise cannot be fingerprinted.
 */
export function computeMLBShadowModelFingerprint(
  model: MLBDeterministicLogisticRegressionModel,
): string {
  const validation = validateMLBDeterministicLogisticRegressionModel(model);
  if (!validation.ok) {
    throw new Error(
      `Model validation failed: ${validation.issues[0]?.code ?? 'unknown'} at ${validation.issues[0]?.path ?? '$'}`,
    );
  }

  const validatedModel = validation.value;

  /**
   * Exact canonical payload — element order is frozen by the spec.
   * NO recursive key sorting.
   */
  const payload: unknown[] = [
    MLB_SHADOW_MODEL_FINGERPRINT_CONTRACT_VERSION,

    validatedModel.contractVersion,
    validatedModel.sport,
    validatedModel.target,
    validatedModel.targetEncoding,

    validatedModel.modelId,
    validatedModel.planId,
    validatedModel.matrixId,
    validatedModel.configId,
    validatedModel.manifestId,
    validatedModel.datasetId,

    validatedModel.algorithm,

    validatedModel.featureIds,

    validatedModel.intercept,

    validatedModel.coefficients.map((coefficient) => [
      coefficient.featureId,
      coefficient.valueCoefficient,
      coefficient.missingIndicatorCoefficient,
    ]),

    validatedModel.trainingRowCount,
    validatedModel.iterationsCompleted,
    validatedModel.converged,
    validatedModel.finalTrainingObjective,
  ];

  assertAllNumbersFiniteAndNonNegativeZero(payload, '$');

  const canonicalJson = JSON.stringify(payload);
  return createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

/* -------------------------------------------------------------------------- */
/*  Authoritative model gate                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Verifies that the supplied model is the frozen candidate-003 model by
 * comparing its computed fingerprint against the authoritative hash.
 *
 * Fails closed: returns false on ANY error (validation failure, non-finite
 * numbers, negative zero, hash mismatch).
 */
export function verifyMLBShadowCandidate003AuthoritativeModel(
  model: MLBDeterministicLogisticRegressionModel,
): boolean {
  try {
    const fingerprint = computeMLBShadowModelFingerprint(model);
    return (
      fingerprint === MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256
    );
  } catch {
    return false;
  }
}
