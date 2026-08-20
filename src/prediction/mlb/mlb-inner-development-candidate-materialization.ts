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
  type MLBInnerDevelopmentCampaignProvenance,
} from './mlb-inner-development-campaign-provenance';
import {
  type MLBInnerCandidateRecipe,
} from './mlb-train-only-inner-development-evaluator';
import {
  validateMLBModelTrainingConfiguration,
  type MLBModelTrainingConfiguration,
  MLB_MODEL_TRAINING_CONFIGURATION_CONTRACT_VERSION,
} from './mlb-model-training-plan-contract';

export type MLBInnerMaterializedCandidate = Readonly<{
  candidateRecipeId: string;
  configuration: MLBModelTrainingConfiguration;
  provenance: MLBInnerDevelopmentCampaignProvenance;
}>;

export type MLBInnerDevelopmentCandidateMaterializationFailureState =
  | 'UNSUPPORTED_MODEL_FAMILY'
  | 'INVALID_REGULARIZATION_RECIPE'
  | 'INVALID_OPTIMIZER_RECIPE'
  | 'UNSUPPORTED_PREPROCESSING_POLICY'
  | 'UNSUPPORTED_FEATURE_POLICY'
  | 'UNSUPPORTED_OTHER_MODEL_CHOICES'
  | 'PROVENANCE_INVARIANT_VIOLATION';

export type MLBInnerDevelopmentCandidateMaterializationIssue = Readonly<{
  code: string;
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCandidateMaterializationResult =
  | { ok: true; materialized: MLBInnerMaterializedCandidate }
  | {
      ok: false;
      state: MLBInnerDevelopmentCandidateMaterializationFailureState;
      issues: readonly MLBInnerDevelopmentCandidateMaterializationIssue[];
    };

const CANONICAL_PREPROCESSING_POLICY_ID =
  MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID;

const CANONICAL_FEATURE_POLICY_ID =
  MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID;

const CANONICAL_MODEL_FAMILY_ID = 'L2_LOGISTIC_REGRESSION_BINARY_V1';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function ownDataProperty(
  root: Record<string, unknown>,
  key: string,
): { kind: 'data'; value: unknown } | { kind: 'missing' } {
  const descriptor = Object.getOwnPropertyDescriptor(root, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!('value' in descriptor)) {
    return { kind: 'missing' };
  }
  return { kind: 'data', value: descriptor.value };
}

function pushIssue(
  issues: MLBInnerDevelopmentCandidateMaterializationIssue[],
  code: string,
  path: string,
  message: string,
): void {
  issues.push({ code, path, message });
}

function validateRegularizationRecipe(
  value: unknown,
  path: string,
  issues: MLBInnerDevelopmentCandidateMaterializationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      'INVALID_REGULARIZATION_RECIPE',
      path,
      'regularizationConfig must be a plain object',
    );
    return;
  }

  const root = value as Record<string, unknown>;
  const knownFields = new Set(['kind', 'strength']);
  const ownKeys = Object.getOwnPropertyNames(root);
  for (const key of ownKeys) {
    if (!knownFields.has(key)) {
      pushIssue(
        issues,
        'INVALID_REGULARIZATION_RECIPE',
        `${path}.${key}`,
        `Unknown regularization field: ${key}`,
      );
    }
  }

  const kindResult = ownDataProperty(root, 'kind');
  if (kindResult.kind === 'missing') {
    pushIssue(
      issues,
      'INVALID_REGULARIZATION_RECIPE',
      `${path}.kind`,
      'kind is required',
    );
  } else if (kindResult.value !== 'L2') {
    pushIssue(
      issues,
      'INVALID_REGULARIZATION_RECIPE',
      `${path}.kind`,
      'kind must be L2',
    );
  }

  const strengthResult = ownDataProperty(root, 'strength');
  if (strengthResult.kind === 'missing') {
    pushIssue(
      issues,
      'INVALID_REGULARIZATION_RECIPE',
      `${path}.strength`,
      'strength is required',
    );
  } else if (
    typeof strengthResult.value !== 'number' ||
    !Number.isFinite(strengthResult.value) ||
    strengthResult.value <= 0 ||
    1 / strengthResult.value === -Infinity
  ) {
    pushIssue(
      issues,
      'INVALID_REGULARIZATION_RECIPE',
      `${path}.strength`,
      'strength must be a finite number strictly greater than zero',
    );
  }
}

function validateOptimizerRecipe(
  value: unknown,
  path: string,
  issues: MLBInnerDevelopmentCandidateMaterializationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      'INVALID_OPTIMIZER_RECIPE',
      path,
      'optimizerConfig must be a plain object',
    );
    return;
  }

  const root = value as Record<string, unknown>;
  const knownFields = new Set([
    'solver',
    'learningRate',
    'maxIterations',
    'tolerance',
  ]);
  const ownKeys = Object.getOwnPropertyNames(root);
  for (const key of ownKeys) {
    if (!knownFields.has(key)) {
      pushIssue(
        issues,
        'INVALID_OPTIMIZER_RECIPE',
        `${path}.${key}`,
        `Unknown optimizer field: ${key}`,
      );
    }
  }

  const solverResult = ownDataProperty(root, 'solver');
  if (solverResult.kind === 'missing') {
    pushIssue(
      issues,
      'INVALID_OPTIMIZER_RECIPE',
      `${path}.solver`,
      'solver is required',
    );
  } else if (solverResult.value !== 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1') {
    pushIssue(
      issues,
      'INVALID_OPTIMIZER_RECIPE',
      `${path}.solver`,
      'solver must be DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
    );
  }

  const learningRateResult = ownDataProperty(root, 'learningRate');
  if (learningRateResult.kind === 'missing') {
    pushIssue(
      issues,
      'INVALID_OPTIMIZER_RECIPE',
      `${path}.learningRate`,
      'learningRate is required',
    );
  } else if (
    typeof learningRateResult.value !== 'number' ||
    !Number.isFinite(learningRateResult.value) ||
    learningRateResult.value <= 0 ||
    learningRateResult.value > 1 ||
    1 / learningRateResult.value === -Infinity
  ) {
    pushIssue(
      issues,
      'INVALID_OPTIMIZER_RECIPE',
      `${path}.learningRate`,
      'learningRate must be a finite number strictly greater than zero and at most 1',
    );
  }

  const maxIterationsResult = ownDataProperty(root, 'maxIterations');
  if (maxIterationsResult.kind === 'missing') {
    pushIssue(
      issues,
      'INVALID_OPTIMIZER_RECIPE',
      `${path}.maxIterations`,
      'maxIterations is required',
    );
  } else if (
    typeof maxIterationsResult.value !== 'number' ||
    !Number.isSafeInteger(maxIterationsResult.value) ||
    maxIterationsResult.value <= 0 ||
    maxIterationsResult.value > 1_000_000
  ) {
    pushIssue(
      issues,
      'INVALID_OPTIMIZER_RECIPE',
      `${path}.maxIterations`,
      'maxIterations must be a positive safe integer at most 1000000',
    );
  }

  const toleranceResult = ownDataProperty(root, 'tolerance');
  if (toleranceResult.kind === 'missing') {
    pushIssue(
      issues,
      'INVALID_OPTIMIZER_RECIPE',
      `${path}.tolerance`,
      'tolerance is required',
    );
  } else if (
    typeof toleranceResult.value !== 'number' ||
    !Number.isFinite(toleranceResult.value) ||
    toleranceResult.value <= 0 ||
    toleranceResult.value >= 1 ||
    1 / toleranceResult.value === -Infinity
  ) {
    pushIssue(
      issues,
      'INVALID_OPTIMIZER_RECIPE',
      `${path}.tolerance`,
      'tolerance must be a finite number strictly greater than zero and less than 1',
    );
  }
}

function validateOtherModelAffectingChoices(
  value: unknown,
  path: string,
  issues: MLBInnerDevelopmentCandidateMaterializationIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(
      issues,
      'UNSUPPORTED_OTHER_MODEL_CHOICES',
      path,
      'otherModelAffectingChoices must be a plain object',
    );
    return;
  }

  const root = value as Record<string, unknown>;
  const ownKeys = Object.getOwnPropertyNames(root);
  if (ownKeys.length > 0) {
    pushIssue(
      issues,
      'UNSUPPORTED_OTHER_MODEL_CHOICES',
      path,
      'otherModelAffectingChoices must be empty',
    );
  }
}

function buildMaterializedProvenance(): MLBInnerDevelopmentCampaignProvenance {
  return Object.freeze({
    datasetId: MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ID,
    datasetSha256: MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_SHA256,
    datasetRowCount: MLB_INNER_DEVELOPMENT_CAMPAIGN_DATASET_ROW_COUNT,
    outerTrainRowCount: MLB_INNER_DEVELOPMENT_CAMPAIGN_OUTER_TRAIN_ROW_COUNT,
    featurePolicyId: MLB_INNER_DEVELOPMENT_CAMPAIGN_FEATURE_POLICY_ID,
    manifestId: MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
    preprocessingPolicyId: MLB_INNER_DEVELOPMENT_CAMPAIGN_PREPROCESSING_POLICY_ID,
    matrixId: MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_ID,
    matrixSha256: MLB_INNER_DEVELOPMENT_CAMPAIGN_MATRIX_SHA256,
  });
}

export function materializeMLBInnerDevelopmentCandidateRecipe(
  recipe: MLBInnerCandidateRecipe,
): MLBInnerDevelopmentCandidateMaterializationResult {
  const issues: MLBInnerDevelopmentCandidateMaterializationIssue[] = [];

  if (recipe.preprocessingPolicyId !== CANONICAL_PREPROCESSING_POLICY_ID) {
    pushIssue(
      issues,
      'UNSUPPORTED_PREPROCESSING_POLICY',
      '$.preprocessingPolicyId',
      `preprocessingPolicyId must be ${CANONICAL_PREPROCESSING_POLICY_ID}`,
    );
  }

  if (recipe.featurePolicyId !== CANONICAL_FEATURE_POLICY_ID) {
    pushIssue(
      issues,
      'UNSUPPORTED_FEATURE_POLICY',
      '$.featurePolicyId',
      `featurePolicyId must be ${CANONICAL_FEATURE_POLICY_ID}`,
    );
  }

  if (recipe.modelFamilyId !== CANONICAL_MODEL_FAMILY_ID) {
    pushIssue(
      issues,
      'UNSUPPORTED_MODEL_FAMILY',
      '$.modelFamilyId',
      `modelFamilyId must be ${CANONICAL_MODEL_FAMILY_ID}`,
    );
  }

  validateRegularizationRecipe(
    recipe.regularizationConfig,
    '$.regularizationConfig',
    issues,
  );
  validateOptimizerRecipe(recipe.optimizerConfig, '$.optimizerConfig', issues);
  validateOtherModelAffectingChoices(
    recipe.otherModelAffectingChoices,
    '$.otherModelAffectingChoices',
    issues,
  );

  if (issues.length > 0) {
    return {
      ok: false as const,
      state: issues[0].code as MLBInnerDevelopmentCandidateMaterializationFailureState,
      issues: Object.freeze([...issues] as readonly MLBInnerDevelopmentCandidateMaterializationIssue[]),
    };
  }

  const regularization = recipe.regularizationConfig as {
    kind: 'L2';
    strength: number;
  };
  const optimization = recipe.optimizerConfig as {
    solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1';
    learningRate: number;
    maxIterations: number;
    tolerance: number;
  };

  const configurationValue = {
    contractVersion: MLB_MODEL_TRAINING_CONFIGURATION_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0' as const,
    configId: recipe.candidateRecipeId,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1' as const,
    randomnessPolicy: 'NO_RANDOMNESS' as const,
    featureValuePolicy: 'RAW_FINITE_FEATURE_VALUES' as const,
    missingIndicatorPolicy: 'PRESERVE_WAS_MISSING_FLAGS' as const,
    regularization: {
      kind: 'L2' as const,
      strength: regularization.strength,
    },
    optimization: {
      solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1' as const,
      learningRate: optimization.learningRate,
      maxIterations: optimization.maxIterations,
      tolerance: optimization.tolerance,
    },
  };

  const validationResult = validateMLBModelTrainingConfiguration(
    configurationValue,
  );
  if (!validationResult.ok) {
    return {
      ok: false as const,
      state: 'PROVENANCE_INVARIANT_VIOLATION',
      issues: Object.freeze([]),
    };
  }

  const materialized: MLBInnerMaterializedCandidate = Object.freeze({
    candidateRecipeId: recipe.candidateRecipeId,
    configuration: Object.freeze(validationResult.value),
    provenance: Object.freeze(buildMaterializedProvenance()),
  });

  return { ok: true as const, materialized };
}
