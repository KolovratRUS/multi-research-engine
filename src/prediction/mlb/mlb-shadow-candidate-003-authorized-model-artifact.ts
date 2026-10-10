/* -------------------------------------------------------------------------- */
/*  Immutable authorized model artifact — candidate-003                        */
/*  (L5E2X-P5B-C2: frozen packaging only — no fitting, no reconstruction,      */
/*   no runtime filesystem/train/network access.)                              */
/* -------------------------------------------------------------------------- */

import {
  MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
  type MLBDeterministicLogisticRegressionModel,
  type MLBModelCoefficient,
  validateMLBDeterministicLogisticRegressionModel,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import {
  MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
  computeMLBShadowModelFingerprint,
  verifyMLBShadowCandidate003AuthoritativeModel,
} from '@/prediction/mlb/mlb-shadow-model-fingerprint';
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

/* -------------------------------------------------------------------------- */
/*  Contract version                                                          */
/* -------------------------------------------------------------------------- */

export const MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION =
  'mlb-shadow-candidate-003-authorized-model-artifact-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Expected model identity literals                                          */
/*  Values recovered from /tmp/mre-l5e2x-p5b-m1/candidate-003-model-a.json    */
/* -------------------------------------------------------------------------- */

const MLB_SHADOW_CANDIDATE003_EXPECTED_MODEL_ID =
  'mlb-v1-inner-candidate-003::plan-v1::model-v1' as const;
const MLB_SHADOW_CANDIDATE003_EXPECTED_PLAN_ID =
  'mlb-v1-inner-candidate-003::plan-v1' as const;
const MLB_SHADOW_CANDIDATE003_EXPECTED_ITERATIONS_COMPLETED = 528;
const MLB_SHADOW_CANDIDATE003_EXPECTED_FINAL_TRAINING_OBJECTIVE =
  0.6833056399549484;
const MLB_SHADOW_CANDIDATE003_EXPECTED_INTERCEPT = 0.004266984963800175;

/* -------------------------------------------------------------------------- */
/*  Known field-keys for unknown-field rejection                            */
/* -------------------------------------------------------------------------- */

const MLB_SHADOW_CANDIDATE003_AUTHORIZED_ARTIFACT_ROOT_FIELDS = new Set<
  string
>(['contractVersion', 'model', 'attestation']);

const MLB_SHADOW_CANDIDATE003_AUTHORIZED_ATTESTATION_FIELDS = new Set<
  string
>([
  'candidateRecipeId',
  'candidateRecipeFingerprint',
  'modelCanonicalFingerprint',
  'trainArtifactSha256',
  'trainRowCount',
  'manifestId',
  'manifestFingerprint',
  'outerValidationPromotionEvaluationId',
]);

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type MLBShadowCandidate003AuthorizedModelArtifactAttestation =
  Readonly<{
    candidateRecipeId: string;
    candidateRecipeFingerprint: string;
    modelCanonicalFingerprint: string;
    trainArtifactSha256: string;
    trainRowCount: number;
    manifestId: string;
    manifestFingerprint: string;
    outerValidationPromotionEvaluationId: string;
  }>;

export type MLBShadowCandidate003AuthorizedModelArtifact = Readonly<{
  contractVersion: typeof MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION;
  model: MLBDeterministicLogisticRegressionModel;
  attestation: MLBShadowCandidate003AuthorizedModelArtifactAttestation;
}>;

export type MLBShadowCandidate003AuthorizedModelArtifactIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'INVALID_BOOLEAN'
    | 'INVALID_ARRAY'
    | 'MODEL_INVALID'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'FEATURE_SCHEMA_MISMATCH'
    | 'MANIFEST_MISMATCH'
    | 'NON_CANONICAL_ORDER'
    | 'NONFINITE_NUMBER';
  path: string;
  message: string;
}>;

export type MLBShadowCandidate003AuthorizedModelArtifactValidationResult =
  | Readonly<{
      ok: true;
      value: MLBShadowCandidate003AuthorizedModelArtifact;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBShadowCandidate003AuthorizedModelArtifactIssue[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Validation helpers                                                        */
/* -------------------------------------------------------------------------- */

function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

type OwnDataPropertyResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'accessor' }>
  | Readonly<{ kind: 'data'; value: unknown }>;

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
): OwnDataPropertyResult {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${path} is an accessor property`,
    );
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function pushIssue(
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
  code: MLBShadowCandidate003AuthorizedModelArtifactIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some(
    (item) => item.path === path && item.code === code,
  );
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function pushUniquePathCode(
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
  next: MLBShadowCandidate003AuthorizedModelArtifactIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

function sortIssues(
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
): MLBShadowCandidate003AuthorizedModelArtifactIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) return pathDiff;
      const codeDiff = a.code < b.code ? -1 : a.code === b.code ? 0 : 1;
      return codeDiff;
    })
    .filter(
      (item, index, array) =>
        index === 0 ||
        item.path !== array[index - 1].path ||
        item.code !== array[index - 1].code,
    );
}

function addKnownFieldIssues(
  record: Record<string, unknown>,
  known: Set<string>,
  path: string,
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
): void {
  const names = Object.getOwnPropertyNames(record);
  for (const key of names) {
    if (!known.has(key)) {
      pushIssue(
        issues,
        'UNKNOWN_FIELD',
        `${path}.${key}`,
        `Unknown field: ${key}`,
      );
    }
  }
}

type ForeignIssue = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

function adaptForeignIssues(
  destination: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
  localCode: MLBShadowCandidate003AuthorizedModelArtifactIssue['code'],
  pathPrefix: string,
  foreignIssues: readonly ForeignIssue[],
): void {
  for (const issue of foreignIssues) {
    const prefixedPath = pathPrefix
      ? `${pathPrefix}.${issue.path.replace(/^\$\.?/, '')}`
      : issue.path;
    pushUniquePathCode(destination, {
      code: localCode,
      path: prefixedPath,
      message: `[${issue.code}] ${issue.message}`,
    });
  }
}

/* -------------------------------------------------------------------------- */
/*  Manifest feature IDs (frozen provenance, extracted for ordering checks)   */
/* -------------------------------------------------------------------------- */

const MLB_SHADOW_CANDIDATE003_MANIFEST_FEATURE_IDS: readonly string[] =
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1.features.map(
    (feature) => feature.featureId,
  );

/* -------------------------------------------------------------------------- */
/*  Embedded recovered model (deep-frozen)                                    */
/*  Exact values recovered from /tmp/mre-l5e2x-p5b-m1/candidate-003-model-a.json */
/* -------------------------------------------------------------------------- */

const MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL: MLBDeterministicLogisticRegressionModel =
  Object.freeze({
    contractVersion: MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    modelId: MLB_SHADOW_CANDIDATE003_EXPECTED_MODEL_ID,
    planId: MLB_SHADOW_CANDIDATE003_EXPECTED_PLAN_ID,
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    configId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
    datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    featureIds: Object.freeze([
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
    ]),
    intercept: MLB_SHADOW_CANDIDATE003_EXPECTED_INTERCEPT,
    coefficients: Object.freeze([
      Object.freeze({
        featureId: 'awayBullpenExtraInningGames',
        valueCoefficient: 0.006410621443824374,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'awayBullpenGamesInPrevious3Days',
        valueCoefficient: 0.062184989740699394,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'awayRunsAllowedPerGame',
        valueCoefficient: -0.04580417731791942,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'awayRunsScoredPerGame',
        valueCoefficient: -0.0968889941229032,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'awayStarterAvailable',
        valueCoefficient: 0,
        missingIndicatorCoefficient: 0.0031406735952362866,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'awayWinRate',
        valueCoefficient: -0.024022941488343195,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'doubleHeaderGameNumber',
        valueCoefficient: 0.011859202638432608,
        missingIndicatorCoefficient: 0.004308202131016179,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'homeBullpenExtraInningGames',
        valueCoefficient: -0.09612414124359463,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'homeBullpenGamesInPrevious3Days',
        valueCoefficient: 0.016996463333255517,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'homeRunsAllowedPerGame',
        valueCoefficient: 0.014800079647428618,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'homeRunsScoredPerGame',
        valueCoefficient: 0.08618179714588282,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'homeStarterAvailable',
        valueCoefficient: 0,
        missingIndicatorCoefficient: 0.0031406735952362866,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'homeWinRate',
        valueCoefficient: 0.004308399717451391,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
      Object.freeze({
        featureId: 'scheduledInnings',
        valueCoefficient: 0.02826606235712657,
        missingIndicatorCoefficient: 0,
      }) as MLBModelCoefficient,
    ]),
    trainingRowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
    iterationsCompleted: MLB_SHADOW_CANDIDATE003_EXPECTED_ITERATIONS_COMPLETED,
    converged: true,
    finalTrainingObjective: MLB_SHADOW_CANDIDATE003_EXPECTED_FINAL_TRAINING_OBJECTIVE,
  });

/* -------------------------------------------------------------------------- */
/*  Attestation (deep-frozen, sourced from production constants)               */
/* -------------------------------------------------------------------------- */

const MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ATTESTATION: MLBShadowCandidate003AuthorizedModelArtifactAttestation =
  Object.freeze({
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateRecipeFingerprint:
      MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    modelCanonicalFingerprint:
      MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256,
    trainArtifactSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    trainRowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
    manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
    manifestFingerprint: MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
    outerValidationPromotionEvaluationId:
      MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID,
  });

/* -------------------------------------------------------------------------- */
/*  Frozen artifact root                                                      */
/* -------------------------------------------------------------------------- */

const MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT: MLBShadowCandidate003AuthorizedModelArtifact =
  Object.freeze({
    contractVersion: MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
    model: MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL,
    attestation: MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ATTESTATION,
  });

/* -------------------------------------------------------------------------- */
/*  Module-load-time invariant checks                                         */
/*  Fail loudly if the embedded model diverges from the proven fingerprint.    */
/* -------------------------------------------------------------------------- */

const _MLB_SHADOW_CANDIDATE003_EMBEDDED_FINGERPRINT =
  computeMLBShadowModelFingerprint(MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL);

if (
  _MLB_SHADOW_CANDIDATE003_EMBEDDED_FINGERPRINT !==
  MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256
) {
  throw new Error(
    `Embedded candidate-003 model fingerprint mismatch: ` +
      `${_MLB_SHADOW_CANDIDATE003_EMBEDDED_FINGERPRINT} !== ` +
      `${MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256}`,
  );
}

if (
  !verifyMLBShadowCandidate003AuthoritativeModel(
    MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL,
  )
) {
  throw new Error(
    'Embedded candidate-003 model failed the authoritative model gate.',
  );
}

/* -------------------------------------------------------------------------- */
/*  Getter                                                                      */
/* -------------------------------------------------------------------------- */

export function getMLBShadowCandidate003AuthorizedModelArtifact(): MLBShadowCandidate003AuthorizedModelArtifact {
  return MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT;
}

/* -------------------------------------------------------------------------- */
/*  Validator                                                                   */
/* -------------------------------------------------------------------------- */

function checkModelIdentity(
  model: MLBDeterministicLogisticRegressionModel,
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
): void {
  if (model.modelId !== MLB_SHADOW_CANDIDATE003_EXPECTED_MODEL_ID) {
    pushIssue(
      issues,
      'INVALID_LITERAL',
      '$.model.modelId',
      'modelId mismatch',
    );
  }
  if (model.planId !== MLB_SHADOW_CANDIDATE003_EXPECTED_PLAN_ID) {
    pushIssue(
      issues,
      'INVALID_LITERAL',
      '$.model.planId',
      'planId mismatch',
    );
  }
  if (
    model.configId !== MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID
  ) {
    pushIssue(
      issues,
      'INVALID_LITERAL',
      '$.model.configId',
      'configId mismatch',
    );
  }
  if (model.datasetId !== MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID) {
    pushIssue(
      issues,
      'INVALID_LITERAL',
      '$.model.datasetId',
      'datasetId mismatch',
    );
  }
  if (model.matrixId !== MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID) {
    pushIssue(
      issues,
      'INVALID_LITERAL',
      '$.model.matrixId',
      'matrixId mismatch',
    );
  }
  if (model.manifestId !== MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID) {
    pushIssue(
      issues,
      'INVALID_LITERAL',
      '$.model.manifestId',
      'manifestId mismatch',
    );
  }
  if (model.algorithm !== 'L2_LOGISTIC_REGRESSION_BINARY_V1') {
    pushIssue(
      issues,
      'INVALID_LITERAL',
      '$.model.algorithm',
      'algorithm mismatch',
    );
  }
}

function checkFeatureOrdering(
  model: MLBDeterministicLogisticRegressionModel,
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
): void {
  if (model.featureIds.length !== MLB_SHADOW_CANDIDATE003_MANIFEST_FEATURE_IDS.length) {
    pushIssue(
      issues,
      'FEATURE_SCHEMA_MISMATCH',
      '$.model.featureIds',
      'featureIds length does not match manifest',
    );
  }
  for (let i = 0; i < MLB_SHADOW_CANDIDATE003_MANIFEST_FEATURE_IDS.length && i < model.featureIds.length; i++) {
    if (model.featureIds[i] !== MLB_SHADOW_CANDIDATE003_MANIFEST_FEATURE_IDS[i]) {
      pushIssue(
        issues,
        'NON_CANONICAL_ORDER',
        '$.model.featureIds',
        'featureIds ordering does not match manifest',
      );
      break;
    }
  }
}

function checkTrainingMetadata(
  model: MLBDeterministicLogisticRegressionModel,
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
): void {
  if (model.trainingRowCount !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT) {
    pushIssue(
      issues,
      'INVALID_NUMBER',
      '$.model.trainingRowCount',
      'trainingRowCount mismatch',
    );
  }
  if (model.iterationsCompleted !== MLB_SHADOW_CANDIDATE003_EXPECTED_ITERATIONS_COMPLETED) {
    pushIssue(
      issues,
      'INVALID_NUMBER',
      '$.model.iterationsCompleted',
      'iterationsCompleted mismatch',
    );
  }
  if (model.converged !== true) {
    pushIssue(
      issues,
      'INVALID_BOOLEAN',
      '$.model.converged',
      'converged must be true',
    );
  }
  if (
    model.finalTrainingObjective !==
    MLB_SHADOW_CANDIDATE003_EXPECTED_FINAL_TRAINING_OBJECTIVE
  ) {
    pushIssue(
      issues,
      'INVALID_NUMBER',
      '$.model.finalTrainingObjective',
      'finalTrainingObjective mismatch',
    );
  }
  if (model.intercept !== MLB_SHADOW_CANDIDATE003_EXPECTED_INTERCEPT) {
    pushIssue(
      issues,
      'INVALID_NUMBER',
      '$.model.intercept',
      'intercept mismatch',
    );
  }
}

function checkCoefficients(
  model: MLBDeterministicLogisticRegressionModel,
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
): void {
  const expected = MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL.coefficients;
  if (model.coefficients.length !== expected.length) {
    pushIssue(
      issues,
      'INVALID_ARRAY',
      '$.model.coefficients',
      'coefficients length mismatch',
    );
    return;
  }
  for (let i = 0; i < expected.length; i++) {
    const expectedCoeff = expected[i];
    const actualCoeff = model.coefficients[i];
    if (actualCoeff.featureId !== expectedCoeff.featureId) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        `$.model.coefficients[${i}].featureId`,
        'coefficient featureId mismatch',
      );
    }
    if (
      actualCoeff.valueCoefficient !== expectedCoeff.valueCoefficient
    ) {
      pushIssue(
        issues,
        'INVALID_NUMBER',
        `$.model.coefficients[${i}].valueCoefficient`,
        'coefficient value mismatch',
      );
    }
    if (
      actualCoeff.missingIndicatorCoefficient !==
      expectedCoeff.missingIndicatorCoefficient
    ) {
      pushIssue(
        issues,
        'INVALID_NUMBER',
        `$.model.coefficients[${i}].missingIndicatorCoefficient`,
        'coefficient value mismatch',
      );
    }
  }
}

function validateAttestation(
  value: unknown,
  issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[],
): MLBShadowCandidate003AuthorizedModelArtifactAttestation | undefined {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      'NOT_PLAIN_OBJECT',
      '$.attestation',
      'attestation must be a plain object',
    );
    return undefined;
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(
    root,
    MLB_SHADOW_CANDIDATE003_AUTHORIZED_ATTESTATION_FIELDS,
    '$.attestation',
    issues,
  );

  const candidateRecipeIdResult = ownDataProperty(
    root,
    'candidateRecipeId',
    '$.attestation.candidateRecipeId',
    issues,
  );
  let candidateRecipeId: string | undefined;
  if (candidateRecipeIdResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.attestation.candidateRecipeId',
      'candidateRecipeId is required',
    );
  } else if (candidateRecipeIdResult.kind === 'data') {
    if (
      candidateRecipeIdResult.value !==
      MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID
    ) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.attestation.candidateRecipeId',
        'candidateRecipeId mismatch',
      );
    } else {
      candidateRecipeId = candidateRecipeIdResult.value as string;
    }
  }

  const candidateRecipeFingerprintResult = ownDataProperty(
    root,
    'candidateRecipeFingerprint',
    '$.attestation.candidateRecipeFingerprint',
    issues,
  );
  let candidateRecipeFingerprint: string | undefined;
  if (candidateRecipeFingerprintResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.attestation.candidateRecipeFingerprint',
      'candidateRecipeFingerprint is required',
    );
  } else if (candidateRecipeFingerprintResult.kind === 'data') {
    if (
      candidateRecipeFingerprintResult.value !==
      MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT
    ) {
      pushIssue(
        issues,
        'SOURCE_IDENTITY_MISMATCH',
        '$.attestation.candidateRecipeFingerprint',
        'candidateRecipeFingerprint mismatch',
      );
    } else {
      candidateRecipeFingerprint =
        candidateRecipeFingerprintResult.value as string;
    }
  }

  const modelCanonicalFingerprintResult = ownDataProperty(
    root,
    'modelCanonicalFingerprint',
    '$.attestation.modelCanonicalFingerprint',
    issues,
  );
  let modelCanonicalFingerprint: string | undefined;
  if (modelCanonicalFingerprintResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.attestation.modelCanonicalFingerprint',
      'modelCanonicalFingerprint is required',
    );
  } else if (modelCanonicalFingerprintResult.kind === 'data') {
    if (
      modelCanonicalFingerprintResult.value !==
      MLB_SHADOW_CANDIDATE003_AUTHORITATIVE_MODEL_SHA256
    ) {
      pushIssue(
        issues,
        'SOURCE_IDENTITY_MISMATCH',
        '$.attestation.modelCanonicalFingerprint',
        'modelCanonicalFingerprint does not match canonical hash',
      );
    } else {
      modelCanonicalFingerprint =
        modelCanonicalFingerprintResult.value as string;
    }
  }

  const trainArtifactSha256Result = ownDataProperty(
    root,
    'trainArtifactSha256',
    '$.attestation.trainArtifactSha256',
    issues,
  );
  let trainArtifactSha256: string | undefined;
  if (trainArtifactSha256Result.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.attestation.trainArtifactSha256',
      'trainArtifactSha256 is required',
    );
  } else if (trainArtifactSha256Result.kind === 'data') {
    if (
      trainArtifactSha256Result.value !==
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256
    ) {
      pushIssue(
        issues,
        'SOURCE_IDENTITY_MISMATCH',
        '$.attestation.trainArtifactSha256',
        'trainArtifactSha256 mismatch',
      );
    } else {
      trainArtifactSha256 = trainArtifactSha256Result.value as string;
    }
  }

  const trainRowCountResult = ownDataProperty(
    root,
    'trainRowCount',
    '$.attestation.trainRowCount',
    issues,
  );
  let trainRowCount: number | undefined;
  if (trainRowCountResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.attestation.trainRowCount',
      'trainRowCount is required',
    );
  } else if (trainRowCountResult.kind === 'data') {
    if (
      trainRowCountResult.value !==
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT
    ) {
      pushIssue(
        issues,
        'INVALID_NUMBER',
        '$.attestation.trainRowCount',
        'trainRowCount mismatch',
      );
    } else {
      trainRowCount = trainRowCountResult.value as number;
    }
  }

  const manifestIdResult = ownDataProperty(
    root,
    'manifestId',
    '$.attestation.manifestId',
    issues,
  );
  let manifestId: string | undefined;
  if (manifestIdResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.attestation.manifestId',
      'manifestId is required',
    );
  } else if (manifestIdResult.kind === 'data') {
    if (
      manifestIdResult.value !== MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID
    ) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.attestation.manifestId',
        'manifestId mismatch',
      );
    } else {
      manifestId = manifestIdResult.value as string;
    }
  }

  const manifestFingerprintResult = ownDataProperty(
    root,
    'manifestFingerprint',
    '$.attestation.manifestFingerprint',
    issues,
  );
  let manifestFingerprint: string | undefined;
  if (manifestFingerprintResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.attestation.manifestFingerprint',
      'manifestFingerprint is required',
    );
  } else if (manifestFingerprintResult.kind === 'data') {
    if (
      manifestFingerprintResult.value !==
      MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT
    ) {
      pushIssue(
        issues,
        'SOURCE_IDENTITY_MISMATCH',
        '$.attestation.manifestFingerprint',
        'manifestFingerprint mismatch',
      );
    } else {
      manifestFingerprint = manifestFingerprintResult.value as string;
    }
  }

  const outerValidationPromotionEvaluationIdResult = ownDataProperty(
    root,
    'outerValidationPromotionEvaluationId',
    '$.attestation.outerValidationPromotionEvaluationId',
    issues,
  );
  let outerValidationPromotionEvaluationId: string | undefined;
  if (outerValidationPromotionEvaluationIdResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.attestation.outerValidationPromotionEvaluationId',
      'outerValidationPromotionEvaluationId is required',
    );
  } else if (outerValidationPromotionEvaluationIdResult.kind === 'data') {
    if (
      outerValidationPromotionEvaluationIdResult.value !==
      MLB_OUTER_VALIDATION_PROMOTION_EVALUATION_ID
    ) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.attestation.outerValidationPromotionEvaluationId',
        'outerValidationPromotionEvaluationId mismatch',
      );
    } else {
      outerValidationPromotionEvaluationId =
        outerValidationPromotionEvaluationIdResult.value as string;
    }
  }

  // If any field was missing or had the wrong type, we can't construct the attestation
  if (
    candidateRecipeId === undefined ||
    candidateRecipeFingerprint === undefined ||
    modelCanonicalFingerprint === undefined ||
    trainArtifactSha256 === undefined ||
    trainRowCount === undefined ||
    manifestId === undefined ||
    manifestFingerprint === undefined ||
    outerValidationPromotionEvaluationId === undefined
  ) {
    return undefined;
  }

  return {
    candidateRecipeId,
    candidateRecipeFingerprint,
    modelCanonicalFingerprint,
    trainArtifactSha256,
    trainRowCount,
    manifestId,
    manifestFingerprint,
    outerValidationPromotionEvaluationId,
  } as MLBShadowCandidate003AuthorizedModelArtifactAttestation;
}

export function validateMLBShadowCandidate003AuthorizedModelArtifact(
  value: unknown,
): MLBShadowCandidate003AuthorizedModelArtifactValidationResult {
  const issues: MLBShadowCandidate003AuthorizedModelArtifactIssue[] = [];

  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      'NOT_PLAIN_OBJECT',
      '$',
      'Expected plain object',
    );
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(
    root,
    MLB_SHADOW_CANDIDATE003_AUTHORIZED_ARTIFACT_ROOT_FIELDS,
    '$',
    issues,
  );

  const contractVersionResult = ownDataProperty(
    root,
    'contractVersion',
    '$.contractVersion',
    issues,
  );
  if (contractVersionResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.contractVersion',
      'contractVersion is required',
    );
  } else if (contractVersionResult.kind === 'data') {
    if (
      contractVersionResult.value !==
      MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION
    ) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        'contractVersion mismatch',
      );
    }
  }

  const modelResult = ownDataProperty(root, 'model', '$.model', issues);
  let validatedModel: MLBDeterministicLogisticRegressionModel | undefined;
  if (modelResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.model',
      'model is required',
    );
  } else if (modelResult.kind === 'data') {
    const modelValidation =
      validateMLBDeterministicLogisticRegressionModel(modelResult.value);
    if (!modelValidation.ok) {
      adaptForeignIssues(
        issues,
        'MODEL_INVALID',
        '$.model',
        modelValidation.issues,
      );
    } else {
      validatedModel = modelValidation.value;
      checkModelIdentity(validatedModel, issues);
      checkFeatureOrdering(validatedModel, issues);
      checkTrainingMetadata(validatedModel, issues);
      checkCoefficients(validatedModel, issues);
    }
  }

  const attestationResult = ownDataProperty(
    root,
    'attestation',
    '$.attestation',
    issues,
  );
  let validatedAttestation:
    | MLBShadowCandidate003AuthorizedModelArtifactAttestation
    | undefined;
  if (attestationResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.attestation',
      'attestation is required',
    );
  } else if (attestationResult.kind === 'data') {
    validatedAttestation = validateAttestation(
      attestationResult.value,
      issues,
    );
  }

  /* ------------------------------------------------------ */
  /*  Cross-checks                                          */
  /* ------------------------------------------------------ */

  if (validatedModel && validatedAttestation) {
    if (
      validatedModel.manifestId !== validatedAttestation.manifestId
    ) {
      pushIssue(
        issues,
        'MANIFEST_MISMATCH',
        '$.attestation.manifestId',
        'model manifestId does not match attestation manifestId',
      );
    }

    if (
      validatedModel.trainingRowCount !==
      validatedAttestation.trainRowCount
    ) {
      pushIssue(
        issues,
        'SOURCE_IDENTITY_MISMATCH',
        '$.attestation.trainRowCount',
        'model trainingRowCount does not match attestation trainRowCount',
      );
    }

    const computedFingerprint =
      computeMLBShadowModelFingerprint(validatedModel);
    if (
      computedFingerprint !==
      validatedAttestation.modelCanonicalFingerprint
    ) {
      pushIssue(
        issues,
        'SOURCE_IDENTITY_MISMATCH',
        '$.attestation.modelCanonicalFingerprint',
        'model fingerprint does not match attestation modelCanonicalFingerprint',
      );
    }

    if (
      !verifyMLBShadowCandidate003AuthoritativeModel(validatedModel)
    ) {
      pushIssue(
        issues,
        'MODEL_INVALID',
        '$.model',
        'model failed the authoritative candidate-003 gate',
      );
    }
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return {
    ok: true,
    value: {
      contractVersion: MLB_SHADOW_CANDIDATE003_AUTHORIZED_MODEL_ARTIFACT_CONTRACT_VERSION,
      model: validatedModel as MLBDeterministicLogisticRegressionModel,
      attestation: validatedAttestation as MLBShadowCandidate003AuthorizedModelArtifactAttestation,
    },
  };
}
