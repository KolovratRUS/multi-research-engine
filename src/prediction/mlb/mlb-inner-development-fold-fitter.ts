import type {
  MLBDeterministicLogisticRegressionModel,
  MLBModelCoefficient,
} from './mlb-logistic-regression-fit-contract';
import {
  fitMLBDeterministicLogisticRegressionModel,
  predictMLBHomeWinProbability,
} from './mlb-logistic-regression-fit-contract';
import { validateMLBFeatureVector } from './mlb-feature-vector-contract';
import { validateMLBModelTrainingConfiguration } from './mlb-model-training-plan-contract';
import type { MLBExtractedFeatureValue } from './mlb-feature-vector-contract';
import type { MLBFeatureVector } from './mlb-feature-vector-contract';
import type { MLBInnerCandidatePredictionRecord } from './mlb-train-only-inner-development-evaluator';
import type { MLBModelTrainingConfiguration } from './mlb-model-training-plan-contract';
import type { MLBTrainingMatrixRow } from './mlb-training-matrix-contract';

export type MLBInnerDevelopmentFoldFitInput = Readonly<{
  configuration: MLBModelTrainingConfiguration;
  trainRows: readonly MLBTrainingMatrixRow[];
  validationRows: readonly MLBTrainingMatrixRow[];
  foldId: string;
  candidateRecipeId: string;
}>;

export type MLBInnerDevelopmentFoldFitSuccess = Readonly<{
  foldId: string;
  candidateRecipeId: string;
  predictions: readonly MLBInnerCandidatePredictionRecord[];
  modelMetadata: Readonly<{
    converged: boolean;
    iterationsCompleted: number;
    finalTrainingObjective: number;
    featureIds: readonly string[];
    trainingRowCount: number;
  }>;
  lowLevelFitCount: 1;
}>;

export type MLBInnerDevelopmentFoldFitIssue = Readonly<{
  code:
    | 'INVALID_CONFIGURATION'
    | 'INVALID_TRAIN_ROWS'
    | 'INVALID_VALIDATION_ROWS'
    | 'INVALID_FEATURE_SCHEMA'
    | 'INSUFFICIENT_CLASS_VARIATION'
    | 'MODEL_FIT_FAILURE'
    | 'NONFINITE_PREDICTION'
    | 'PREDICTION_ALIGNMENT_FAILURE';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentFoldFitOutcome =
  | Readonly<{ ok: true; value: MLBInnerDevelopmentFoldFitSuccess }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentFoldFitIssue[]; lowLevelFitCount: number }>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === null || Object.getPrototypeOf(value) === Object.prototype)
  );
}

function extractFeatureSchema(
  values: readonly MLBExtractedFeatureValue[],
): readonly string[] {
  return values.map((value) => value.featureId);
}

function validateTrainRow(
  row: unknown,
  path: string,
): row is MLBTrainingMatrixRow {
  if (!isPlainObject(row)) {
    return false;
  }
  if (row.split !== 'TRAIN') {
    return false;
  }
  if (typeof row.exampleId !== 'string' || row.exampleId.length === 0) {
    return false;
  }
  if (!isPlainObject(row.vector)) {
    return false;
  }
  if (typeof row.targetValue !== 'number' || !Number.isFinite(row.targetValue) || (row.targetValue !== 0 && row.targetValue !== 1)) {
    return false;
  }
  return true;
}

function validateValidationRow(
  row: unknown,
  path: string,
): row is MLBTrainingMatrixRow {
  if (!isPlainObject(row)) {
    return false;
  }
  if (row.split !== 'VALIDATION') {
    return false;
  }
  if (typeof row.exampleId !== 'string' || row.exampleId.length === 0) {
    return false;
  }
  if (!isPlainObject(row.vector)) {
    return false;
  }
  if (typeof row.targetValue !== 'number' || !Number.isFinite(row.targetValue) || (row.targetValue !== 0 && row.targetValue !== 1)) {
    return false;
  }
  return true;
}

function buildTemporaryModel(
  fitValue: {
    coefficients: MLBModelCoefficient[];
    intercept: number;
    iterationsCompleted: number;
    converged: boolean;
    finalTrainingObjective: number;
    trainingRowCount: number;
    featureIds: readonly string[];
  },
  configuration: MLBModelTrainingConfiguration,
  candidateRecipeId: string,
  foldId: string,
): MLBDeterministicLogisticRegressionModel {
  return {
    contractVersion: 'mlb-deterministic-logistic-regression-model-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    modelId: `${candidateRecipeId}::${foldId}::model-v1`,
    planId: `${candidateRecipeId}::${foldId}::plan-v1`,
    matrixId: `${candidateRecipeId}::${foldId}::matrix-v1`,
    configId: configuration.configId,
    manifestId: '',
    datasetId: '',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    featureIds: fitValue.featureIds,
    intercept: fitValue.intercept,
    coefficients: fitValue.coefficients,
    trainingRowCount: fitValue.trainingRowCount,
    iterationsCompleted: fitValue.iterationsCompleted,
    converged: fitValue.converged,
    finalTrainingObjective: fitValue.finalTrainingObjective,
  };
}

export function fitMLBInnerDevelopmentFold(
  input: MLBInnerDevelopmentFoldFitInput,
): MLBInnerDevelopmentFoldFitOutcome {
  const preflightIssues: MLBInnerDevelopmentFoldFitIssue[] = [];

  if (!Array.isArray(input.trainRows) || input.trainRows.length === 0) {
    preflightIssues.push({
      code: 'INVALID_TRAIN_ROWS',
      path: '$.trainRows',
      message: 'trainRows must be a non-empty array',
    });
  }

  if (!Array.isArray(input.validationRows) || input.validationRows.length === 0) {
    preflightIssues.push({
      code: 'INVALID_VALIDATION_ROWS',
      path: '$.validationRows',
      message: 'validationRows must be a non-empty array',
    });
  }

  if (typeof input.foldId !== 'string' || input.foldId.length === 0) {
    preflightIssues.push({
      code: 'INVALID_CONFIGURATION',
      path: '$.foldId',
      message: 'foldId must be a non-empty string',
    });
  }

  if (typeof input.candidateRecipeId !== 'string' || input.candidateRecipeId.length === 0) {
    preflightIssues.push({
      code: 'INVALID_CONFIGURATION',
      path: '$.candidateRecipeId',
      message: 'candidateRecipeId must be a non-empty string',
    });
  }

  if (preflightIssues.length > 0) {
    return { ok: false, issues: preflightIssues, lowLevelFitCount: 0 };
  }

  const configurationResult = validateMLBModelTrainingConfiguration(input.configuration);
  if (!configurationResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_CONFIGURATION',
          path: '$.configuration',
          message: `Configuration invalid: ${configurationResult.issues[0]?.code ?? 'unknown'} at ${configurationResult.issues[0]?.path ?? '$'}`,
        },
      ],
      lowLevelFitCount: 0,
    };
  }

  const trainRows = input.trainRows;
  const validationRows = input.validationRows;

  const trainIssues: MLBInnerDevelopmentFoldFitIssue[] = [];
  const featureSchemas: Array<readonly string[]> = [];
  let hasPositive = false;
  let hasNegative = false;

  for (let i = 0; i < trainRows.length; i++) {
    const row = trainRows[i];
    const rowPath = `$.trainRows[${i}]`;

    if (!validateTrainRow(row, rowPath)) {
      trainIssues.push({
        code: 'INVALID_TRAIN_ROWS',
        path: rowPath,
        message: 'Row structure invalid',
      });
      continue;
    }

    const vectorResult = validateMLBFeatureVector(row.vector);
    if (!vectorResult.ok) {
      trainIssues.push({
        code: 'INVALID_TRAIN_ROWS',
        path: rowPath,
        message: `Feature vector invalid: ${vectorResult.issues[0]?.code ?? 'unknown'}`,
      });
      continue;
    }

    featureSchemas.push(extractFeatureSchema(row.vector.values));

    if (row.targetValue === 1) {
      hasPositive = true;
    } else if (row.targetValue === 0) {
      hasNegative = true;
    }
  }

  if (trainIssues.length > 0) {
    return { ok: false, issues: trainIssues, lowLevelFitCount: 0 };
  }

  const referenceSchema = featureSchemas[0];
  const schemaMismatch = featureSchemas.some(
    (schema) =>
      schema.length !== referenceSchema.length ||
      schema.some((featureId, index) => featureId !== referenceSchema[index]),
  );
  if (schemaMismatch) {
    trainIssues.push({
      code: 'INVALID_FEATURE_SCHEMA',
      path: '$.trainRows',
      message: 'Inconsistent feature schema across train rows',
    });
  }

  if (!hasPositive || !hasNegative) {
    trainIssues.push({
      code: 'INSUFFICIENT_CLASS_VARIATION',
      path: '$.trainRows',
      message: 'TRAIN split must contain at least one target 0 and one target 1',
    });
  }

  if (trainIssues.length > 0) {
    return { ok: false, issues: trainIssues, lowLevelFitCount: 0 };
  }

  const validationIssues: MLBInnerDevelopmentFoldFitIssue[] = [];
  const seenExampleIds = new Set<string>();
  let validationSchemaMismatch = false;

  for (let i = 0; i < validationRows.length; i++) {
    const row = validationRows[i];
    const rowPath = `$.validationRows[${i}]`;

    if (!validateValidationRow(row, rowPath)) {
      validationIssues.push({
        code: 'INVALID_VALIDATION_ROWS',
        path: rowPath,
        message: 'Row structure invalid',
      });
      continue;
    }

    const vectorResult = validateMLBFeatureVector(row.vector);
    if (!vectorResult.ok) {
      validationIssues.push({
        code: 'INVALID_VALIDATION_ROWS',
        path: rowPath,
        message: `Feature vector invalid: ${vectorResult.issues[0]?.code ?? 'unknown'}`,
      });
      continue;
    }

    const schema = extractFeatureSchema(row.vector.values);
    if (
      schema.length !== referenceSchema.length ||
      schema.some((featureId, index) => featureId !== referenceSchema[index])
    ) {
      validationSchemaMismatch = true;
    }

    if (seenExampleIds.has(row.exampleId)) {
      validationIssues.push({
        code: 'INVALID_VALIDATION_ROWS',
        path: rowPath,
        message: 'Duplicate exampleId in validation rows',
      });
    } else {
      seenExampleIds.add(row.exampleId);
    }
  }

  if (validationSchemaMismatch) {
    validationIssues.push({
      code: 'INVALID_FEATURE_SCHEMA',
      path: '$.validationRows',
      message: 'Feature schema does not match train rows',
    });
  }

  if (validationIssues.length > 0) {
    return { ok: false, issues: validationIssues, lowLevelFitCount: 0 };
  }

  const featureIds = Array.from(referenceSchema);
  const fitResult = fitMLBDeterministicLogisticRegressionModel(
    input.configuration,
    featureIds,
    trainRows,
  );

  if (!fitResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'MODEL_FIT_FAILURE',
          path: '$.fit',
          message: 'Shared primitive fit failed',
        },
      ],
      lowLevelFitCount: 1,
    };
  }

  const model = buildTemporaryModel(fitResult.value, input.configuration, input.candidateRecipeId, input.foldId);

  const predictions: MLBInnerCandidatePredictionRecord[] = [];
  for (let i = 0; i < validationRows.length; i++) {
    const row = validationRows[i];
    const probability = predictMLBHomeWinProbability(model, row.vector);

    if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
      return {
        ok: false,
        issues: [
          {
            code: 'NONFINITE_PREDICTION',
            path: `$.validationRows[${i}]`,
            message: 'Prediction is not a finite probability in [0,1]',
          },
        ],
        lowLevelFitCount: 1,
      };
    }

    predictions.push({
      candidateRecipeId: input.candidateRecipeId,
      foldId: input.foldId,
      exampleId: row.exampleId,
      homeWinProbability: probability,
    });
  }

  if (predictions.length !== validationRows.length) {
    return {
      ok: false,
      issues: [
        {
          code: 'PREDICTION_ALIGNMENT_FAILURE',
          path: '$.predictions',
          message: 'Prediction count does not match validation row count',
        },
      ],
      lowLevelFitCount: 1,
    };
  }

  return {
    ok: true,
    value: {
      foldId: input.foldId,
      candidateRecipeId: input.candidateRecipeId,
      predictions,
      modelMetadata: {
        converged: fitResult.value.converged,
        iterationsCompleted: fitResult.value.iterationsCompleted,
        finalTrainingObjective: fitResult.value.finalTrainingObjective,
        featureIds: fitResult.value.featureIds,
        trainingRowCount: fitResult.value.trainingRowCount,
      },
      lowLevelFitCount: 1,
    },
  };
}
