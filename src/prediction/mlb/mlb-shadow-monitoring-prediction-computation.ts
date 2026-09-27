/* -------------------------------------------------------------------------- */
/*  Quarantined pure prediction computation (L5E2Q)                           */
/* -------------------------------------------------------------------------- */

/**
 * Adapts the existing frozen candidate-003 pure inference logic
 * (inferMLBOfflinePregameWinner) into a quarantined prediction payload.
 *
 * Properties:
 *  - Reuses frozen candidate inference — no duplicated coefficients or feature logic.
 *  - Produces a valid MLBShadowQuarantinedPredictionPayload.
 *  - Pure and deterministic for explicit inputs (no Date.now, Math.random, I/O, network).
 *  - Performs ZERO persistence.
 *
 * The caller supplies opaque shadow metadata (shadowRecordId, gamePk,
 * predictionGeneratedAt) plus the existing candidate-compatible inference
 * inputs (releasedModelResult, featureManifest, snapshot).
 *
 * Execution ordering is frozen:
 *   1. validate released result / obtain validated model
 *   2. verifyMLBShadowCandidate003AuthoritativeModel(model)  ← fail-closed gate
 *   3. ONLY THEN call inferMLBOfflinePregameWinner(...)
 *   4. construct quarantined prediction
 *   5. validate quarantined prediction
 *   6. return quarantined prediction only
 */

import { createHash } from 'node:crypto';
import {
  inferMLBOfflinePregameWinner,
  type MLBOfflinePregameInference,
  type MLBOfflinePregameInferenceIssue,
} from '@/prediction/mlb/mlb-offline-pregame-inference-contract';
import {
  type MLBDeterministicLogisticRegressionModel,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import {
  validateMLBModelTestReleaseResult,
  type MLBModelTestReleaseIssue,
} from '@/prediction/mlb/mlb-model-test-release-contract';
import {
  verifyMLBShadowCandidate003AuthoritativeModel,
} from '@/prediction/mlb/mlb-shadow-model-fingerprint';
import {
  type MLBShadowQuarantinedPredictionPayload,
  validateMLBShadowQuarantinedPredictionPayload,
  type MLBShadowQuarantineValidationIssue,
  type MLBShadowQuarantineValidationResult,
} from '@/prediction/mlb/mlb-shadow-monitoring-quarantine-contract';

/* -------------------------------------------------------------------------- */
/*  Input type                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Input for computeMLBShadowQuarantinedPrediction.
 *
 * The caller supplies opaque shadow metadata and the existing
 * candidate-compatible inference inputs. No outcome data is accepted.
 */
export type MLBShadowQuarantinedPredictionInput = Readonly<{
  shadowRecordId: string;
  gamePk: number;
  predictionGeneratedAt: string;
  releasedModelResult: unknown;
  featureManifest: unknown;
  snapshot: unknown;
}>;

/* -------------------------------------------------------------------------- */
/*  Canonical hash field order (excludes payloadHash itself)                  */
/* -------------------------------------------------------------------------- */

/**
 * Explicit canonical field order for payload hash computation.
 * The hash is computed over this deterministic serialization,
 * excluding the payloadHash field itself.
 */
const CANONICAL_PAYLOAD_FIELD_ORDER = [
  'shadowRecordId',
  'gamePk',
  'predictedWinner',
  'predictedSide',
  'homeWinProbability',
  'awayWinProbability',
  'decisionPolicy',
  'predictionGeneratedAt',
] as const;

/* -------------------------------------------------------------------------- */
/*  Pure hash computation                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Computes SHA-256 of the canonical deterministic serialization of
 * the quarantined prediction fields, excluding payloadHash itself.
 *
 * Uses node:crypto only — no filesystem I/O.
 * The payload hash is separate from the model fingerprint.
 */
function computeShadowPayloadHash(
  payloadWithoutHash: Omit<MLBShadowQuarantinedPredictionPayload, 'payloadHash'>,
): string {
  const canonicalJson = JSON.stringify({
    shadowRecordId: payloadWithoutHash.shadowRecordId,
    gamePk: payloadWithoutHash.gamePk,
    predictedWinner: payloadWithoutHash.predictedWinner,
    predictedSide: payloadWithoutHash.predictedSide,
    homeWinProbability: payloadWithoutHash.homeWinProbability,
    awayWinProbability: payloadWithoutHash.awayWinProbability,
    decisionPolicy: payloadWithoutHash.decisionPolicy,
    predictionGeneratedAt: payloadWithoutHash.predictionGeneratedAt,
  });

  const serializedKeys = Object.keys(JSON.parse(canonicalJson) as Record<string, unknown>);
  for (let i = 0; i < CANONICAL_PAYLOAD_FIELD_ORDER.length; i++) {
    if (serializedKeys[i] !== CANONICAL_PAYLOAD_FIELD_ORDER[i]) {
      throw new Error(
        `Canonical key order mismatch at index ${i}: ` +
        `expected ${CANONICAL_PAYLOAD_FIELD_ORDER[i]}, got ${serializedKeys[i] ?? 'undefined'}`,
      );
    }
  }

  return createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

/* -------------------------------------------------------------------------- */
/*  Issue mapping                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Converts a model-release-validation failure into quarantine validation
 * issues. Release issue codes come from the release contract namespace
 * which are not valid quarantine issue codes, so we normalize them to
 * INVALID_JSON_VALUE (a member of the quarantine issue code union).
 */
function mapReleaseIssues(
  issues: readonly MLBModelTestReleaseIssue[],
): MLBShadowQuarantineValidationIssue[] {
  return issues.map((issue) => ({
    code: 'INVALID_JSON_VALUE' as const,
    path: issue.path,
    message: `${issue.code}: ${issue.message}`,
  }));
}

/**
 * Converts an inference validation failure into quarantine validation issues.
 * Inference issues carry codes from the inference contract namespace which
 * are not valid quarantine issue codes, so we normalize them to
 * INVALID_JSON_VALUE (a member of the quarantine issue code union).
 */
function mapInferenceIssues(
  issues: readonly MLBOfflinePregameInferenceIssue[],
): MLBShadowQuarantineValidationIssue[] {
  return issues.map((issue) => ({
    code: 'INVALID_JSON_VALUE' as const,
    path: issue.path,
    message: `${issue.code}: ${issue.message}`,
  }));
}

/* -------------------------------------------------------------------------- */
/*  Quarantined prediction computation                                        */
/* -------------------------------------------------------------------------- */

/**
 * Computes a quarantined shadow prediction by delegating to the existing
 * frozen candidate-003 pure inference logic.
 *
 * @param input - Shadow metadata (shadowRecordId, gamePk, predictionGeneratedAt)
 *                plus candidate-compatible inference inputs.
 * @returns A validated MLBShadowQuarantinedPredictionPayload, or failure issues.
 */
export function computeMLBShadowQuarantinedPrediction(
  input: MLBShadowQuarantinedPredictionInput,
): MLBShadowQuarantineValidationResult<MLBShadowQuarantinedPredictionPayload> {
  // Step 1: Validate the released model result and obtain the validated model.
  // Extraction path: releasedModelResult.fitValidation.model
  const releaseValidation = validateMLBModelTestReleaseResult(
    input.releasedModelResult,
  );
  if (!releaseValidation.ok) {
    return {
      ok: false,
      issues: mapReleaseIssues(releaseValidation.issues),
    };
  }

  const model: MLBDeterministicLogisticRegressionModel =
    releaseValidation.value.fitValidation.model;

  // Step 2: Verify the model is the frozen candidate-003 model BEFORE
  // any inference is permitted. Fail closed: arbitrary released models
  // are never accepted as candidate-003.
  if (!verifyMLBShadowCandidate003AuthoritativeModel(model)) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_JSON_VALUE' as const,
          path: '$.releasedModelResult.fitValidation.model',
          message:
            'Released model did not match frozen candidate-003 fingerprint',
        },
      ],
    };
  }

  // Step 3: ONLY THEN call the frozen candidate-003 pure inference logic.
  const inferenceResult = inferMLBOfflinePregameWinner(
    input.releasedModelResult,
    input.featureManifest,
    input.snapshot,
  );

  if (!inferenceResult.ok) {
    return { ok: false, issues: mapInferenceIssues(inferenceResult.issues) };
  }

  const inference: MLBOfflinePregameInference = inferenceResult.value;

  // Step 4: Construct the quarantined prediction payload from inference output.
  // predictedWinner equals predictedSide: the side with probability >= 0.5
  // is the predicted winner.
  const predictedWinner: 'HOME' | 'AWAY' = inference.predictedSide;

  const payloadWithoutHash: Omit<
    MLBShadowQuarantinedPredictionPayload,
    'payloadHash'
  > = {
    shadowRecordId: input.shadowRecordId,
    gamePk: input.gamePk,
    predictedWinner,
    predictedSide: inference.predictedSide,
    homeWinProbability: inference.probabilities.homeWinProbability,
    awayWinProbability: inference.probabilities.awayWinProbability,
    decisionPolicy: inference.decisionPolicy,
    predictionGeneratedAt: input.predictionGeneratedAt,
  };

  // Step 5: Compute the payload hash (separate from model fingerprint)
  //         and validate the complete quarantined prediction payload.
  const payloadHash = computeShadowPayloadHash(payloadWithoutHash);

  const payload: MLBShadowQuarantinedPredictionPayload = {
    ...payloadWithoutHash,
    payloadHash,
  };

  const validation = validateMLBShadowQuarantinedPredictionPayload(payload);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  // Step 6: Return the validated quarantined prediction only.
  return { ok: true, value: validation.value };
}
