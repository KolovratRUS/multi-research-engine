/* -------------------------------------------------------------------------- */
/*  PURE V2 SHADOW PREDICTION COMPUTATION SEAM                                 */
/*  Phase: 8V-D3-C-E4-B4-I3G-LIVE1-L5E2X-P5D-C1                               */
/*                                                                            */
/*  Maps a validated V2 shadow execution job (carrying the authorized        */
/*  Candidate-003 model artifact) to the exact same quarantined prediction    */
/*  payload semantics as V1, without:                                          */
/*    - no release-validated model artifacts / metrics                       */
/*    - historical validation/test metrics                                   */
/*    - TRAIN access                                                          */
/*    - runtime fitting / reconstruction                                      */
/*    - persistence / network / clock / randomness                            */
/*                                                                            */
/*  V1 source-of-truth (read-only, byte-unchanged):                           */
/*    computeMLBShadowQuarantinedPrediction  -> mlb-shadow-monitoring-         */
/*      prediction-computation.ts                                             */
/*    inferMLBOfflinePregameWinner           -> mlb-offline-pregame-          */
/*      inference-contract.ts                                               */
/*    extractMLBLeakageSafeFeatureVector      -> mlb-feature-vector-contract.ts */
/*    validateMLBShadowQuarantinedPredictionPayload                          */
/*      -> mlb-shadow-monitoring-quarantine-contract.ts                      */
/*                                                                            */
/*  No existing V1 production source file is imported or referenced here.     */
/* -------------------------------------------------------------------------- */

import { createHash } from 'node:crypto';
import { validateMLBShadowExecutionJobV2 } from '@/prediction/mlb/mlb-shadow-execution-job-v2-contract';
import { extractMLBLeakageSafeFeatureVector } from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  type MLBShadowQuarantineValidationIssue,
  type MLBShadowQuarantineValidationResult,
  type MLBShadowQuarantinedPredictionPayload,
  validateMLBShadowQuarantinedPredictionPayload,
} from '@/prediction/mlb/mlb-shadow-monitoring-quarantine-contract';

/* -------------------------------------------------------------------------- */
/*  Canonical payload-hash field ordering                                      */
/*  Exact copy of V1 CANONICAL_PAYLOAD_FIELD_ORDER (8 fields).               */
/*  payloadHash is excluded — it is the computed digest.                       */
/* -------------------------------------------------------------------------- */
const V2_CANONICAL_PAYLOAD_FIELD_ORDER = [
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
/*  Decision policy string                                                     */
/*  Reproduced from V1 MLB_OFFLINE_PREGAME_DECISION_POLICY.                    */
/*  NOT imported from the V1 inference contract (prohibited by boundary).      */
/* -------------------------------------------------------------------------- */
const V2_DECISION_POLICY = 'HOME_AT_OR_ABOVE_0_5_V1';

/* -------------------------------------------------------------------------- */
/*  Payload hash — exact V1 canonicalization                                   */
/*  SHA-256 of JSON.stringify({...}) with keys in V2_CANONICAL_PAYLOAD_FIELD_  */
/*  ORDER.  createHash is pure computation (no I/O, no randomness).            */
/* -------------------------------------------------------------------------- */
function computeV2ShadowPayloadHash(
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

  /* Verify key ordering matches the canonical field order (exact V1 behaviour). */
  const serializedKeys = Object.keys(
    JSON.parse(canonicalJson) as Record<string, unknown>,
  );
  for (let i = 0; i < V2_CANONICAL_PAYLOAD_FIELD_ORDER.length; i++) {
    if (serializedKeys[i] !== V2_CANONICAL_PAYLOAD_FIELD_ORDER[i]) {
      throw new Error(
        `Canonical key order mismatch at index ${i}: ` +
          `expected ${V2_CANONICAL_PAYLOAD_FIELD_ORDER[i]}, got ${serializedKeys[i] ?? 'undefined'}`,
      );
    }
  }

  return createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
}

/* -------------------------------------------------------------------------- */
/*  Issue mapping — normalises arbitrary validation issue codes to the          */
/*  quarantine issue code INVALID_JSON_VALUE (exact V1 mapReleaseIssues /       */
/*  mapInferenceIssues pattern).  No sensitive values are exposed.              */
/* -------------------------------------------------------------------------- */
function mapToQuarantineIssues(
  issues: readonly {
    readonly code: string;
    readonly path: string;
    readonly message: string;
  }[],
): MLBShadowQuarantineValidationIssue[] {
  return issues.map((issue) => ({
    code: 'INVALID_JSON_VALUE' as const,
    path: issue.path,
    message: `${issue.code}: ${issue.message}`,
  }));
}

/** Build a single-issue failure array. */
function singleIssue(
  code: MLBShadowQuarantineValidationIssue['code'],
  path: string,
  message: string,
): MLBShadowQuarantineValidationIssue[] {
  return [{ code, path, message }];
}

/* -------------------------------------------------------------------------- */
/*  Pure V2 shadow prediction computation seam                                 */
/*                                                                            */
/*  Execution ordering (matches V1 computeMLBShadowQuarantinedPrediction):     */
/*  1. Validate V2 execution job.                                             */
/*  2. Obtain validated authorizedModelArtifact.model.                         */
/*  3. Verify cross-field identity (model <-> manifest <-> snapshot).        */
/*  4. Extract leakage-safe feature vector via existing production extractor.  */
/*  5. Score the exact frozen model with exact V1 numerical semantics.        */
/*  6. Apply exact V1 decision policy.                                        */
/*  7. Map predictedSide -> predictedWinner.                                  */
/*  8. Construct the exact quarantined prediction payload shape.              */
/*  9. Compute payloadHash via exact V1 canonicalization.                      */
/* 10. Validate payload via existing quarantine payload validator.            */
/* 11. Return only the validated computation result.                          */
/*                                                                            */
/*  NO filesystem reads, NO network, NO clock read, NO randomness,              */
/*  NO persistence, NO TRAIN/VALIDATION/TEST access, NO model fitting.          */
/* -------------------------------------------------------------------------- */
export function computeMLBShadowQuarantinedPredictionV2(
  input: unknown,
): MLBShadowQuarantineValidationResult<MLBShadowQuarantinedPredictionPayload> {
  /* Step 1 — Validate V2 execution job. */
  const jobValidation = validateMLBShadowExecutionJobV2(input);
  if (!jobValidation.ok) {
    return { ok: false, issues: mapToQuarantineIssues(jobValidation.issues) };
  }
  const job = jobValidation.value;

  /* Step 2 — Obtain the validated authorized model artifact.                  */
  /* The model is transitively enforced as the frozen Candidate-003 model by    */
  /* validateMLBShadowCandidate003AuthorizedModelArtifact (invoked inside       */
  /* validateMLBShadowExecutionJobV2).  V2 sources the model ONLY from            */
  /* validatedJob.authorizedModelArtifact.model — never from TRAIN, filesystem,   */
  /* network, or caller-provided alternate model fields.                        */
  const model = job.authorizedModelArtifact.model;
  const manifest = job.featureManifest;
  const snapshot = job.snapshot;

  /* Step 3 — Cross-field identity verification (parity with V1).               */
  /* Guaranteed by the V2 job validator; defensive checks reproduced here.       */
  if (model.manifestId !== manifest.manifestId) {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_JSON_VALUE',
        '$.manifestId',
        'Model manifestId does not match manifest manifestId',
      ),
    };
  }
  if (model.sport !== manifest.sport) {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_JSON_VALUE',
        '$.sport',
        'Model sport does not match manifest sport',
      ),
    };
  }
  if (model.target !== manifest.target) {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_JSON_VALUE',
        '$.target',
        'Model target does not match manifest target',
      ),
    };
  }

  const modelFeatureIds = Array.from(model.featureIds);
  const manifestFeatureIds = manifest.features.map((f) => f.featureId);
  const coefficientFeatureIds = model.coefficients.map((c) => c.featureId);

  if (modelFeatureIds.length !== manifestFeatureIds.length) {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_JSON_VALUE',
        '$.featureIds',
        'Model featureIds count does not match manifest features count',
      ),
    };
  }
  for (let i = 0; i < modelFeatureIds.length; i++) {
    if (modelFeatureIds[i] !== manifestFeatureIds[i]) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_JSON_VALUE',
          '$.featureIds',
          'Model featureIds do not match manifest featureIds',
        ),
      };
    }
  }

  if (coefficientFeatureIds.length !== manifestFeatureIds.length) {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_JSON_VALUE',
        '$.coefficients',
        'Coefficient featureIds count does not match manifest features count',
      ),
    };
  }
  for (let i = 0; i < coefficientFeatureIds.length; i++) {
    if (coefficientFeatureIds[i] !== manifestFeatureIds[i]) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_JSON_VALUE',
          '$.coefficients',
          'Coefficient featureIds do not match manifest featureIds',
        ),
      };
    }
  }

  /* Sport / target literals — parity with V1 (always true for candidate-003). */
  if (model.sport !== 'MLB') {
    return {
      ok: false,
      issues: singleIssue('INVALID_JSON_VALUE', '$.model.sport', 'Model sport must be MLB'),
    };
  }
  if (snapshot.sport !== 'MLB') {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_JSON_VALUE',
        '$.snapshot.sport',
        'Snapshot sport must be MLB',
      ),
    };
  }
  if (manifest.sport !== 'MLB') {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_JSON_VALUE',
        '$.manifest.sport',
        'Manifest sport must be MLB',
      ),
    };
  }
  if (manifest.target !== 'OFFICIAL_FINAL_GAME_WINNER') {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_JSON_VALUE',
        '$.manifest.target',
        'Manifest target must be OFFICIAL_FINAL_GAME_WINNER',
      ),
    };
  }

  /* Step 4 — Extract leakage-safe feature vector via existing production       */
  /* extractor (extractMLBLeakageSafeFeatureVector).  Feature order, missing    */
  /* value policy, missing indicators, manifest validation, snapshot validation,  */
  /* and odds-contamination protection are all enforced by the existing          */
  /* production function.  No feature logic is duplicated.                       */
  const extractionResult = extractMLBLeakageSafeFeatureVector(
    manifest,
    snapshot,
  );
  if (!extractionResult.ok) {
    return { ok: false, issues: mapToQuarantineIssues(extractionResult.issues) };
  }
  const vector = extractionResult.value;

  /* Verify vector featureIds match manifest (parity with V1). */
  const vectorFeatureIds = vector.values.map((v) => v.featureId);
  if (vectorFeatureIds.length !== manifestFeatureIds.length) {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_JSON_VALUE',
        '$.featureVector',
        'Extracted vector featureIds count does not match manifest',
      ),
    };
  }
  for (let i = 0; i < vectorFeatureIds.length; i++) {
    if (vectorFeatureIds[i] !== manifestFeatureIds[i]) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_JSON_VALUE',
          '$.featureVector',
          'Extracted vector featureIds do not match manifest order',
        ),
      };
    }
  }

  /* Step 5 — Score the exact frozen model with exact V1 numerical semantics.   */
  /* Reproduced EXACTLY from inferMLBOfflinePregameWinner (no simplification,    */
  /* no rounding, no clamping, no calibration).                                  */
  if (!Number.isFinite(model.intercept)) {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_NUMBER',
        '$.model.intercept',
        'Model intercept is not finite',
      ),
    };
  }

  /* linear score = intercept + Σ(valueCoefficient × featureValue +            */
  /*                               missingIndicatorCoefficient × wasMissing)     */
  let score = model.intercept;

  for (let i = 0; i < modelFeatureIds.length; i++) {
    const extracted = vector.values[i];
    const coefficient = model.coefficients[i];

    if (!Number.isFinite(coefficient.valueCoefficient)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.model.coefficients',
          'Value coefficient is not finite',
        ),
      };
    }
    if (!Number.isFinite(coefficient.missingIndicatorCoefficient)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.model.coefficients',
          'Missing-indicator coefficient is not finite',
        ),
      };
    }
    if (!Number.isFinite(extracted.value)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.featureVector',
          'Extracted feature value is not finite',
        ),
      };
    }

    const valueProduct = coefficient.valueCoefficient * extracted.value;
    if (!Number.isFinite(valueProduct)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.inference',
          'Value-coefficient product is not finite',
        ),
      };
    }

    const missingProduct =
      coefficient.missingIndicatorCoefficient *
      (extracted.wasMissing ? 1 : 0);
    if (!Number.isFinite(missingProduct)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.inference',
          'Missing-indicator product is not finite',
        ),
      };
    }

    score = score + valueProduct + missingProduct;
    if (!Number.isFinite(score)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.inference',
          'Linear score is not finite',
        ),
      };
    }
  }

  /* Stable sigmoid — exact V1 implementation.                                   */
  /*   score >= 0  → homeWinProbability = 1 / (1 + exp(-score))                  */
  /*   score <  0  → homeWinProbability = exp(score) / (1 + exp(score))          */
  let homeWinProbability: number;
  if (score >= 0) {
    const expNeg = Math.exp(-score);
    if (!Number.isFinite(expNeg)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.inference',
          'Exponential intermediate is not finite',
        ),
      };
    }
    const denominator = 1 + expNeg;
    if (!Number.isFinite(denominator)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.inference',
          'Sigmoid denominator is not finite',
        ),
      };
    }
    homeWinProbability = 1 / denominator;
  } else {
    const expPos = Math.exp(score);
    if (!Number.isFinite(expPos)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.inference',
          'Exponential intermediate is not finite',
        ),
      };
    }
    const denominator = 1 + expPos;
    if (!Number.isFinite(denominator)) {
      return {
        ok: false,
        issues: singleIssue(
          'INVALID_NUMBER',
          '$.inference',
          'Sigmoid denominator is not finite',
        ),
      };
    }
    homeWinProbability = expPos / denominator;
  }

  if (!Number.isFinite(homeWinProbability)) {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_PROBABILITY',
        '$.inference',
        'Home win probability is not finite',
      ),
    };
  }

  let awayWinProbability = 1 - homeWinProbability;
  if (!Number.isFinite(awayWinProbability)) {
    return {
      ok: false,
      issues: singleIssue(
        'INVALID_PROBABILITY',
        '$.inference',
        'Away win probability is not finite',
      ),
    };
  }

  /* -0 normalization — exact V1 behaviour.                                    */
  if (Object.is(homeWinProbability, -0)) {
    homeWinProbability = 0;
  }
  if (Object.is(awayWinProbability, -0)) {
    awayWinProbability = 0;
  }

  /* Step 6 — Apply exact V1 decision policy: HOME_AT_OR_ABOVE_0_5_V1.         */
  /* Threshold comparison: homeWinProbability >= 0.5 → HOME, else AWAY.          */
  const predictedSide: 'HOME' | 'AWAY' =
    homeWinProbability >= 0.5 ? 'HOME' : 'AWAY';

  /* Step 7 — Map predictedSide → predictedWinner (exact V1: identical).       */
  const predictedWinner: 'HOME' | 'AWAY' = predictedSide;

  /* Step 8 — Construct the exact existing quarantined prediction payload shape.  */
  /* Field set is identical to V1:                                               */
  /*   shadowRecordId, gamePk, predictedWinner, predictedSide,                    */
  /*   homeWinProbability, awayWinProbability, decisionPolicy,                   */
  /*   predictionGeneratedAt, payloadHash.                                       */
  /* No model fingerprint, candidate ID, recipe, coefficients, intercept,        */
  /* release-result, or historical-metrics fields are added.                     */
  const payloadWithoutHash: Omit<
    MLBShadowQuarantinedPredictionPayload,
    'payloadHash'
  > = {
    shadowRecordId: job.shadowRecordId,
    gamePk: job.gamePk,
    predictedWinner,
    predictedSide,
    homeWinProbability,
    awayWinProbability,
    decisionPolicy: V2_DECISION_POLICY,
    predictionGeneratedAt: job.predictionGeneratedAt,
  };

  /* Step 9 — Compute payloadHash using exact V1 canonicalization.              */
  const payloadHash = computeV2ShadowPayloadHash(payloadWithoutHash);

  const payload: MLBShadowQuarantinedPredictionPayload = {
    ...payloadWithoutHash,
    payloadHash,
  };

  /* Step 10 — Validate payload via existing quarantine payload validator.      */
  const validation =
    validateMLBShadowQuarantinedPredictionPayload(payload);
  if (!validation.ok) {
    return { ok: false, issues: validation.issues };
  }

  /* Step 11 — Return only the validated computation result.                    */
  return { ok: true, value: validation.value };
}
