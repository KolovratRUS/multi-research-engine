import {
  assertNoOddsContamination,
} from '../firewall/odds-contamination-guard';
import {
  validateMLBTrainingMatrix,
  type MLBTrainingMatrix,
  type MLBTrainingMatrixRow,
} from './mlb-training-matrix-contract';
import { type MLBFeatureVector } from './mlb-feature-vector-contract';
import {
  MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION,
  validateMLBModelEvaluationPlan,
  validateMLBModelTrainingConfiguration,
  type MLBModelEvaluationPlan,
  type MLBModelTrainingConfiguration,
  type MLBModelTrainingPlanIssue,
} from './mlb-model-training-plan-contract';

export const MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION =
  'mlb-deterministic-logistic-regression-model-v1' as const;

export const MLB_VALIDATION_EVALUATION_CONTRACT_VERSION =
  'mlb-model-validation-evaluation-v1' as const;

export const MLB_FIT_VALIDATION_RESULT_CONTRACT_VERSION =
  'mlb-model-fit-validation-result-v1' as const;

export type MLBModelCoefficient = Readonly<{
  featureId: string;
  valueCoefficient: number;
  missingIndicatorCoefficient: number;
}>;

export type MLBDeterministicLogisticRegressionModel = Readonly<{
  contractVersion: typeof MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  modelId: string;
  planId: string;
  matrixId: string;
  configId: string;
  manifestId: string;
  datasetId: string;
  algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1';
  featureIds: readonly string[];
  intercept: number;
  coefficients: readonly MLBModelCoefficient[];
  trainingRowCount: number;
  iterationsCompleted: number;
  converged: boolean;
  finalTrainingObjective: number;
}>;

export type MLBValidationMetricValues = Readonly<{
  logLoss: number;
  brierScore: number;
  rocAuc: number;
}>;

export type MLBModelValidationEvaluation = Readonly<{
  contractVersion: typeof MLB_VALIDATION_EVALUATION_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  evaluationId: string;
  modelId: string;
  planId: string;
  matrixId: string;
  configId: string;
  split: 'VALIDATION';
  rowCount: number;
  metrics: MLBValidationMetricValues;
}>;

export type MLBModelFitValidationResult = Readonly<{
  contractVersion: typeof MLB_FIT_VALIDATION_RESULT_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  resultId: string;
  model: MLBDeterministicLogisticRegressionModel;
  validation: MLBModelValidationEvaluation;
}>;

export type MLBModelFitEvaluationIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_BOOLEAN'
    | 'INVALID_ARRAY'
    | 'DUPLICATE_ID'
    | 'NON_CANONICAL_ORDER'
    | 'CONFIGURATION_INVALID'
    | 'PLAN_INVALID'
    | 'MATRIX_INVALID'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'FEATURE_SCHEMA_MISMATCH'
    | 'SPLIT_POLICY_MISMATCH'
    | 'SPLIT_COUNT_MISMATCH'
    | 'INSUFFICIENT_CLASS_VARIATION'
    | 'NUMERICAL_FAILURE'
    | 'MODEL_ID_MISMATCH'
    | 'EVALUATION_ID_MISMATCH'
    | 'RESULT_ID_MISMATCH'
    | 'MODEL_INVALID'
    | 'EVALUATION_INVALID'
    | 'GENERATED_RESULT_INVALID'
    | 'ODDS_CONTAMINATION'
    | 'PROHIBITED_CONCEPT';
  path: string;
  message: string;
}>;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
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

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

type OwnDataPropertyResult =
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'accessor' }>
  | Readonly<{ kind: 'data'; value: unknown }>;

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBModelFitEvaluationIssue[],
): OwnDataPropertyResult {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    pushIssue(issues, 'INVALID_JSON_VALUE', path, `${path} is an accessor property`);
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function pushIssue(
  issues: MLBModelFitEvaluationIssue[],
  code: MLBModelFitEvaluationIssue['code'],
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
  issues: MLBModelFitEvaluationIssue[],
  next: MLBModelFitEvaluationIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

function sortIssues(
  issues: MLBModelFitEvaluationIssue[],
): MLBModelFitEvaluationIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) return pathDiff;
      const codeDiff = a.code < b.code ? -1 : a.code === b.code ? 0 : 1;
      return codeDiff;
    })
    .filter((item, index, array) =>
      index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
    );
}

function addKnownFieldIssues(
  record: Record<string, unknown>,
  known: Set<string>,
  path: string,
  issues: MLBModelFitEvaluationIssue[],
): void {
  const names = Object.getOwnPropertyNames(record);
  for (const key of names) {
    if (!known.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`);
    }
  }
  const symbols = Object.getOwnPropertySymbols(record);
  for (const symbol of symbols) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `${path}[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }
}

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
): string | MLBModelFitEvaluationIssue {
  if (!isStrictNonEmptyTrimmedString(value)) {
    return { code: 'INVALID_STRING', path, message: `${label} must be a valid identifier` };
  }
  return value;
}

const PROHIBITED_MODEL_FIELDS = new Set([
  'rows',
  'vectors',
  'values',
  'wasMissing',
  'targetValue',
  'label',
  'homeRuns',
  'awayRuns',
  'winnerTeamId',
  'finalizedAt',
  'source',
  'predictions',
  'probabilities',
  'rowProbabilities',
  'rowPredictions',
  'testEvaluation',
  'recommendation',
  'multi',
  'stake',
  'grading',
]);

const KNOWN_MODEL_ROOT_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'modelId',
  'planId',
  'matrixId',
  'configId',
  'manifestId',
  'datasetId',
  'algorithm',
  'featureIds',
  'intercept',
  'coefficients',
  'trainingRowCount',
  'iterationsCompleted',
  'converged',
  'finalTrainingObjective',
]);

const KNOWN_COEFFICIENT_FIELDS = new Set([
  'featureId',
  'valueCoefficient',
  'missingIndicatorCoefficient',
]);

const KNOWN_EVALUATION_ROOT_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'evaluationId',
  'modelId',
  'planId',
  'matrixId',
  'configId',
  'split',
  'rowCount',
  'metrics',
]);

const KNOWN_METRIC_FIELDS = new Set(['logLoss', 'brierScore', 'rocAuc']);

const KNOWN_RESULT_ROOT_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'resultId',
  'model',
  'validation',
]);

function validateCoefficient(
  value: unknown,
  path: string,
  issues: MLBModelFitEvaluationIssue[],
): MLBModelCoefficient | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'Coefficient must be a plain object');
    return undefined;
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, KNOWN_COEFFICIENT_FIELDS, path, issues);

  const featureIdResult = ownDataProperty(root, 'featureId', `${path}.featureId`, issues);
  let featureId: string | undefined;
  if (featureIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.featureId`, 'featureId is required');
  } else if (featureIdResult.kind === 'data') {
    const id = validateIdentifier(featureIdResult.value, `${path}.featureId`, 'featureId');
    if (typeof id === 'string') {
      featureId = id;
    } else {
      issues.push(id);
    }
  }

  const valueCoefficientResult = ownDataProperty(root, 'valueCoefficient', `${path}.valueCoefficient`, issues);
  let valueCoefficient: number | undefined;
  if (valueCoefficientResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.valueCoefficient`, 'valueCoefficient is required');
  } else if (valueCoefficientResult.kind === 'data') {
    if (
      typeof valueCoefficientResult.value !== 'number' ||
      !Number.isFinite(valueCoefficientResult.value) ||
      valueCoefficientResult.value === 0 && 1 / valueCoefficientResult.value === -Infinity
    ) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.valueCoefficient`, 'valueCoefficient must be finite');
    } else {
      valueCoefficient = valueCoefficientResult.value === 0 ? 0 : valueCoefficientResult.value;
    }
  }

  const missingIndicatorCoefficientResult = ownDataProperty(
    root,
    'missingIndicatorCoefficient',
    `${path}.missingIndicatorCoefficient`,
    issues,
  );
  let missingIndicatorCoefficient: number | undefined;
  if (missingIndicatorCoefficientResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.missingIndicatorCoefficient`, 'missingIndicatorCoefficient is required');
  } else if (missingIndicatorCoefficientResult.kind === 'data') {
    if (
      typeof missingIndicatorCoefficientResult.value !== 'number' ||
      !Number.isFinite(missingIndicatorCoefficientResult.value) ||
      missingIndicatorCoefficientResult.value === 0 && 1 / missingIndicatorCoefficientResult.value === -Infinity
    ) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.missingIndicatorCoefficient`, 'missingIndicatorCoefficient must be finite');
    } else {
      missingIndicatorCoefficient = missingIndicatorCoefficientResult.value === 0 ? 0 : missingIndicatorCoefficientResult.value;
    }
  }

  if (featureId !== undefined && valueCoefficient !== undefined && missingIndicatorCoefficient !== undefined) {
    return {
      featureId,
      valueCoefficient,
      missingIndicatorCoefficient,
    };
  }

  return undefined;
}

function validateModelRoot(
  value: Record<string, unknown>,
  issues: MLBModelFitEvaluationIssue[],
): void {
  addKnownFieldIssues(value, KNOWN_MODEL_ROOT_FIELDS, '$', issues);

  for (const key of Object.getOwnPropertyNames(value)) {
    if (PROHIBITED_MODEL_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'PROHIBITED_CONCEPT', `$.${key}`, `Prohibited field: ${key}`);
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, `Prohibited accessor: ${key}`);
      }
    }
  }

  const symbols = Object.getOwnPropertySymbols(value);
  for (const symbol of symbols) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }

  const contractVersionResult = ownDataProperty(value, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION}`,
      );
    }
  }

  const sportResult = ownDataProperty(value, 'sport', '$.sport', issues);
  if (sportResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.sport', 'sport is required');
  } else if (sportResult.kind === 'data' && sportResult.value !== 'MLB') {
    pushIssue(issues, 'INVALID_LITERAL', '$.sport', 'sport must be MLB');
  }

  const targetResult = ownDataProperty(value, 'target', '$.target', issues);
  if (targetResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.target', 'target is required');
  } else if (targetResult.kind === 'data' && targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER') {
    pushIssue(issues, 'INVALID_LITERAL', '$.target', 'target must be OFFICIAL_FINAL_GAME_WINNER');
  }

  const targetEncodingResult = ownDataProperty(value, 'targetEncoding', '$.targetEncoding', issues);
  if (targetEncodingResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.targetEncoding', 'targetEncoding is required');
  } else if (targetEncodingResult.kind === 'data') {
    if (targetEncodingResult.value !== 'HOME_WIN_1_AWAY_WIN_0') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.targetEncoding',
        'targetEncoding must be HOME_WIN_1_AWAY_WIN_0',
      );
    }
  }

  const modelIdResult = ownDataProperty(value, 'modelId', '$.modelId', issues);
  if (modelIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.modelId', 'modelId is required');
  } else if (modelIdResult.kind === 'data') {
    const id = validateIdentifier(modelIdResult.value, '$.modelId', 'modelId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const planIdResult = ownDataProperty(value, 'planId', '$.planId', issues);
  if (planIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.planId', 'planId is required');
  } else if (planIdResult.kind === 'data') {
    const id = validateIdentifier(planIdResult.value, '$.planId', 'planId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const matrixIdResult = ownDataProperty(value, 'matrixId', '$.matrixId', issues);
  if (matrixIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.matrixId', 'matrixId is required');
  } else if (matrixIdResult.kind === 'data') {
    const id = validateIdentifier(matrixIdResult.value, '$.matrixId', 'matrixId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const configIdResult = ownDataProperty(value, 'configId', '$.configId', issues);
  if (configIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.configId', 'configId is required');
  } else if (configIdResult.kind === 'data') {
    const id = validateIdentifier(configIdResult.value, '$.configId', 'configId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const manifestIdResult = ownDataProperty(value, 'manifestId', '$.manifestId', issues);
  if (manifestIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.manifestId', 'manifestId is required');
  } else if (manifestIdResult.kind === 'data') {
    const id = validateIdentifier(manifestIdResult.value, '$.manifestId', 'manifestId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const datasetIdResult = ownDataProperty(value, 'datasetId', '$.datasetId', issues);
  if (datasetIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetId', 'datasetId is required');
  } else if (datasetIdResult.kind === 'data') {
    const id = validateIdentifier(datasetIdResult.value, '$.datasetId', 'datasetId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const algorithmResult = ownDataProperty(value, 'algorithm', '$.algorithm', issues);
  if (algorithmResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.algorithm', 'algorithm is required');
  } else if (algorithmResult.kind === 'data') {
    if (algorithmResult.value !== 'L2_LOGISTIC_REGRESSION_BINARY_V1') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.algorithm',
        'algorithm must be L2_LOGISTIC_REGRESSION_BINARY_V1',
      );
    }
  }

  const featureIdsResult = ownDataProperty(value, 'featureIds', '$.featureIds', issues);
  if (featureIdsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.featureIds', 'featureIds is required');
  } else if (featureIdsResult.kind === 'data') {
    const arrayResult = readDescriptorSafeArray(featureIdsResult.value, '$.featureIds', issues);
    if (arrayResult !== null) {
      if (arrayResult.length === 0) {
        pushIssue(issues, 'INVALID_ARRAY', '$.featureIds', 'featureIds must not be empty');
      } else {
        const seen = new Set<string>();
        let valid = true;
        for (let i = 0; i < arrayResult.length; i++) {
          const element = arrayResult[i];
          if (typeof element !== 'string') {
            pushIssue(issues, 'INVALID_STRING', `$.featureIds[${i}]`, 'featureId must be a string');
            valid = false;
            continue;
          }
          if (!isStrictNonEmptyTrimmedString(element)) {
            pushIssue(issues, 'INVALID_STRING', `$.featureIds[${i}]`, 'featureId must be a valid identifier');
            valid = false;
            continue;
          }
          if (seen.has(element)) {
            pushIssue(issues, 'DUPLICATE_ID', '$.featureIds', `Duplicate featureId: ${element}`);
            break;
          }
          seen.add(element);
        }
        if (valid) {
          const featureIds = arrayResult as string[];
          for (let i = 1; i < featureIds.length; i++) {
            if (featureIds[i - 1] >= featureIds[i]) {
              pushIssue(issues, 'NON_CANONICAL_ORDER', '$.featureIds', 'featureIds must be in canonical order');
              break;
            }
          }
        }
      }
    }
  }

  const coefficientsResult = ownDataProperty(value, 'coefficients', '$.coefficients', issues);
  if (coefficientsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.coefficients', 'coefficients are required');
  } else if (coefficientsResult.kind === 'data') {
    const coefficientsArrayResult = readDescriptorSafeArray(coefficientsResult.value, '$.coefficients', issues);
    if (coefficientsArrayResult !== null) {
      const featureIdsResult = ownDataProperty(value, 'featureIds', '$.featureIds', issues);
      const expectedLength = featureIdsResult.kind === 'data' && Array.isArray(featureIdsResult.value) ? featureIdsResult.value.length : undefined;
      if (expectedLength !== undefined && coefficientsArrayResult.length !== expectedLength) {
        pushIssue(issues, 'INVALID_ARRAY', '$.coefficients', `coefficients length must equal featureIds length`);
      }
      const seenIds = new Set<string>();
      for (let i = 0; i < coefficientsArrayResult.length; i++) {
        validateCoefficient(coefficientsArrayResult[i], `$.coefficients[${i}]`, issues);
        if (coefficientsArrayResult[i] && isPlainObject(coefficientsArrayResult[i])) {
          const coeff = coefficientsArrayResult[i] as Record<string, unknown>;
          const featureIdResult = ownDataProperty(coeff, 'featureId', `$.coefficients[${i}].featureId`, issues);
          if (featureIdResult.kind === 'data' && typeof featureIdResult.value === 'string') {
            if (seenIds.has(featureIdResult.value)) {
              pushIssue(issues, 'DUPLICATE_ID', '$.coefficients', `Duplicate coefficient featureId: ${featureIdResult.value}`);
            } else {
              seenIds.add(featureIdResult.value);
            }
          }
        }
      }
    }
  }

  const interceptResult = ownDataProperty(value, 'intercept', '$.intercept', issues);
  if (interceptResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.intercept', 'intercept is required');
  } else if (interceptResult.kind === 'data') {
    if (
      typeof interceptResult.value !== 'number' ||
      !Number.isFinite(interceptResult.value) ||
      interceptResult.value === 0 && 1 / interceptResult.value === -Infinity
    ) {
      pushIssue(issues, 'INVALID_NUMBER', '$.intercept', 'intercept must be finite');
    }
  }

  const trainingRowCountResult = ownDataProperty(value, 'trainingRowCount', '$.trainingRowCount', issues);
  if (trainingRowCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.trainingRowCount', 'trainingRowCount is required');
  } else if (trainingRowCountResult.kind === 'data') {
    if (
      typeof trainingRowCountResult.value !== 'number' ||
      !Number.isSafeInteger(trainingRowCountResult.value) ||
      trainingRowCountResult.value <= 0
    ) {
      pushIssue(issues, 'INVALID_INTEGER', '$.trainingRowCount', 'trainingRowCount must be a positive safe integer');
    }
  }

  const iterationsCompletedResult = ownDataProperty(value, 'iterationsCompleted', '$.iterationsCompleted', issues);
  if (iterationsCompletedResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.iterationsCompleted', 'iterationsCompleted is required');
  } else if (iterationsCompletedResult.kind === 'data') {
    if (
      typeof iterationsCompletedResult.value !== 'number' ||
      !Number.isSafeInteger(iterationsCompletedResult.value) ||
      iterationsCompletedResult.value <= 0
    ) {
      pushIssue(issues, 'INVALID_INTEGER', '$.iterationsCompleted', 'iterationsCompleted must be a positive safe integer');
    }
  }

  const convergedResult = ownDataProperty(value, 'converged', '$.converged', issues);
  if (convergedResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.converged', 'converged is required');
  } else if (convergedResult.kind === 'data') {
    if (typeof convergedResult.value !== 'boolean') {
      pushIssue(issues, 'INVALID_BOOLEAN', '$.converged', 'converged must be a boolean');
    }
  }

  const finalTrainingObjectiveResult = ownDataProperty(value, 'finalTrainingObjective', '$.finalTrainingObjective', issues);
  if (finalTrainingObjectiveResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.finalTrainingObjective', 'finalTrainingObjective is required');
  } else if (finalTrainingObjectiveResult.kind === 'data') {
    if (
      typeof finalTrainingObjectiveResult.value !== 'number' ||
      !Number.isFinite(finalTrainingObjectiveResult.value) ||
      finalTrainingObjectiveResult.value < 0 ||
      finalTrainingObjectiveResult.value === 0 && 1 / finalTrainingObjectiveResult.value === -Infinity
    ) {
      pushIssue(issues, 'INVALID_NUMBER', '$.finalTrainingObjective', 'finalTrainingObjective must be a non-negative finite number');
    }
  }
}

function validateMetricsRoot(
  value: unknown,
  path: string,
  issues: MLBModelFitEvaluationIssue[],
): MLBValidationMetricValues | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'metrics must be a plain object');
    return undefined;
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, KNOWN_METRIC_FIELDS, path, issues);

  const logLossResult = ownDataProperty(root, 'logLoss', `${path}.logLoss`, issues);
  let logLoss: number | undefined;
  if (logLossResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.logLoss`, 'logLoss is required');
  } else if (logLossResult.kind === 'data') {
    if (
      typeof logLossResult.value !== 'number' ||
      !Number.isFinite(logLossResult.value) ||
      logLossResult.value < 0 ||
      logLossResult.value === 0 && 1 / logLossResult.value === -Infinity
    ) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.logLoss`, 'logLoss must be a non-negative finite number');
    } else {
      logLoss = logLossResult.value;
    }
  }

  const brierScoreResult = ownDataProperty(root, 'brierScore', `${path}.brierScore`, issues);
  let brierScore: number | undefined;
  if (brierScoreResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.brierScore`, 'brierScore is required');
  } else if (brierScoreResult.kind === 'data') {
    if (
      typeof brierScoreResult.value !== 'number' ||
      !Number.isFinite(brierScoreResult.value) ||
      brierScoreResult.value < 0 ||
      brierScoreResult.value > 1 ||
      brierScoreResult.value === 0 && 1 / brierScoreResult.value === -Infinity
    ) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.brierScore`, 'brierScore must be between 0 and 1 inclusive');
    } else {
      brierScore = brierScoreResult.value;
    }
  }

  const rocAucResult = ownDataProperty(root, 'rocAuc', `${path}.rocAuc`, issues);
  let rocAuc: number | undefined;
  if (rocAucResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.rocAuc`, 'rocAuc is required');
  } else if (rocAucResult.kind === 'data') {
    if (
      typeof rocAucResult.value !== 'number' ||
      !Number.isFinite(rocAucResult.value) ||
      rocAucResult.value < 0 ||
      rocAucResult.value > 1 ||
      rocAucResult.value === 0 && 1 / rocAucResult.value === -Infinity
    ) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.rocAuc`, 'rocAuc must be between 0 and 1 inclusive');
    } else {
      rocAuc = rocAucResult.value;
    }
  }

  if (logLoss !== undefined && brierScore !== undefined && rocAuc !== undefined) {
    return { logLoss, brierScore, rocAuc };
  }

  return undefined;
}

function validateEvaluationRoot(
  value: Record<string, unknown>,
  issues: MLBModelFitEvaluationIssue[],
): void {
  addKnownFieldIssues(value, KNOWN_EVALUATION_ROOT_FIELDS, '$', issues);

  for (const key of Object.getOwnPropertyNames(value)) {
    if (PROHIBITED_MODEL_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'PROHIBITED_CONCEPT', `$.${key}`, `Prohibited field: ${key}`);
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, `Prohibited accessor: ${key}`);
      }
    }
  }

  const symbols = Object.getOwnPropertySymbols(value);
  for (const symbol of symbols) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }

  const contractVersionResult = ownDataProperty(value, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_VALIDATION_EVALUATION_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_VALIDATION_EVALUATION_CONTRACT_VERSION}`,
      );
    }
  }

  const sportResult = ownDataProperty(value, 'sport', '$.sport', issues);
  if (sportResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.sport', 'sport is required');
  } else if (sportResult.kind === 'data' && sportResult.value !== 'MLB') {
    pushIssue(issues, 'INVALID_LITERAL', '$.sport', 'sport must be MLB');
  }

  const targetResult = ownDataProperty(value, 'target', '$.target', issues);
  if (targetResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.target', 'target is required');
  } else if (targetResult.kind === 'data' && targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER') {
    pushIssue(issues, 'INVALID_LITERAL', '$.target', 'target must be OFFICIAL_FINAL_GAME_WINNER');
  }

  const targetEncodingResult = ownDataProperty(value, 'targetEncoding', '$.targetEncoding', issues);
  if (targetEncodingResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.targetEncoding', 'targetEncoding is required');
  } else if (targetEncodingResult.kind === 'data') {
    if (targetEncodingResult.value !== 'HOME_WIN_1_AWAY_WIN_0') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.targetEncoding',
        'targetEncoding must be HOME_WIN_1_AWAY_WIN_0',
      );
    }
  }

  const evaluationIdResult = ownDataProperty(value, 'evaluationId', '$.evaluationId', issues);
  if (evaluationIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.evaluationId', 'evaluationId is required');
  } else if (evaluationIdResult.kind === 'data') {
    const id = validateIdentifier(evaluationIdResult.value, '$.evaluationId', 'evaluationId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const modelIdResult = ownDataProperty(value, 'modelId', '$.modelId', issues);
  if (modelIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.modelId', 'modelId is required');
  } else if (modelIdResult.kind === 'data') {
    const id = validateIdentifier(modelIdResult.value, '$.modelId', 'modelId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const planIdResult = ownDataProperty(value, 'planId', '$.planId', issues);
  if (planIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.planId', 'planId is required');
  } else if (planIdResult.kind === 'data') {
    const id = validateIdentifier(planIdResult.value, '$.planId', 'planId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const matrixIdResult = ownDataProperty(value, 'matrixId', '$.matrixId', issues);
  if (matrixIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.matrixId', 'matrixId is required');
  } else if (matrixIdResult.kind === 'data') {
    const id = validateIdentifier(matrixIdResult.value, '$.matrixId', 'matrixId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const configIdResult = ownDataProperty(value, 'configId', '$.configId', issues);
  if (configIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.configId', 'configId is required');
  } else if (configIdResult.kind === 'data') {
    const id = validateIdentifier(configIdResult.value, '$.configId', 'configId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const splitResult = ownDataProperty(value, 'split', '$.split', issues);
  if (splitResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.split', 'split is required');
  } else if (splitResult.kind === 'data') {
    if (splitResult.value !== 'VALIDATION') {
      pushIssue(issues, 'INVALID_LITERAL', '$.split', 'split must be VALIDATION');
    }
  }

  const rowCountResult = ownDataProperty(value, 'rowCount', '$.rowCount', issues);
  if (rowCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.rowCount', 'rowCount is required');
  } else if (rowCountResult.kind === 'data') {
    if (
      typeof rowCountResult.value !== 'number' ||
      !Number.isSafeInteger(rowCountResult.value) ||
      rowCountResult.value <= 0
    ) {
      pushIssue(issues, 'INVALID_INTEGER', '$.rowCount', 'rowCount must be a positive safe integer');
    }
  }

  const metricsResult = ownDataProperty(value, 'metrics', '$.metrics', issues);
  if (metricsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.metrics', 'metrics is required');
  } else if (metricsResult.kind === 'data') {
    validateMetricsRoot(metricsResult.value, '$.metrics', issues);
  }
}

function validateResultRoot(
  value: Record<string, unknown>,
  issues: MLBModelFitEvaluationIssue[],
): void {
  addKnownFieldIssues(value, KNOWN_RESULT_ROOT_FIELDS, '$', issues);

  for (const key of Object.getOwnPropertyNames(value)) {
    if (PROHIBITED_MODEL_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'PROHIBITED_CONCEPT', `$.${key}`, `Prohibited field: ${key}`);
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, `Prohibited accessor: ${key}`);
      }
    }
  }

  const symbols = Object.getOwnPropertySymbols(value);
  for (const symbol of symbols) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }

  const contractVersionResult = ownDataProperty(value, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_FIT_VALIDATION_RESULT_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_FIT_VALIDATION_RESULT_CONTRACT_VERSION}`,
      );
    }
  }

  const sportResult = ownDataProperty(value, 'sport', '$.sport', issues);
  if (sportResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.sport', 'sport is required');
  } else if (sportResult.kind === 'data' && sportResult.value !== 'MLB') {
    pushIssue(issues, 'INVALID_LITERAL', '$.sport', 'sport must be MLB');
  }

  const targetResult = ownDataProperty(value, 'target', '$.target', issues);
  if (targetResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.target', 'target is required');
  } else if (targetResult.kind === 'data' && targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER') {
    pushIssue(issues, 'INVALID_LITERAL', '$.target', 'target must be OFFICIAL_FINAL_GAME_WINNER');
  }

  const targetEncodingResult = ownDataProperty(value, 'targetEncoding', '$.targetEncoding', issues);
  if (targetEncodingResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.targetEncoding', 'targetEncoding is required');
  } else if (targetEncodingResult.kind === 'data') {
    if (targetEncodingResult.value !== 'HOME_WIN_1_AWAY_WIN_0') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.targetEncoding',
        'targetEncoding must be HOME_WIN_1_AWAY_WIN_0',
      );
    }
  }

  const resultIdResult = ownDataProperty(value, 'resultId', '$.resultId', issues);
  if (resultIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.resultId', 'resultId is required');
  } else if (resultIdResult.kind === 'data') {
    const id = validateIdentifier(resultIdResult.value, '$.resultId', 'resultId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const modelResult = ownDataProperty(value, 'model', '$.model', issues);
  if (modelResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.model', 'model is required');
  } else if (modelResult.kind === 'accessor') {
    pushIssue(issues, 'INVALID_JSON_VALUE', '$.model', 'model is an accessor property');
  } else if (modelResult.kind === 'data') {
    if (!isPlainObject(modelResult.value)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.model', 'model must be a plain object');
    } else {
      validateModelRoot(modelResult.value as Record<string, unknown>, issues);
    }
  }

  const validationResult = ownDataProperty(value, 'validation', '$.validation', issues);
  if (validationResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.validation', 'validation is required');
  } else if (validationResult.kind === 'accessor') {
    pushIssue(issues, 'INVALID_JSON_VALUE', '$.validation', 'validation is an accessor property');
  } else if (validationResult.kind === 'data') {
    if (!isPlainObject(validationResult.value)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.validation', 'validation must be a plain object');
    } else {
      validateEvaluationRoot(validationResult.value as Record<string, unknown>, issues);
    }
  }
}

function readDescriptorSafeArray(
  value: unknown,
  path: string,
  issues: MLBModelFitEvaluationIssue[],
): unknown[] | null {
  if (!Array.isArray(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'Expected array');
    return null;
  }

  const ownNames = Object.getOwnPropertyNames(value);
  for (const key of ownNames) {
    if (key === 'length') {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        String(index) !== key
      ) {
        pushIssue(
          issues,
          'INVALID_JSON_VALUE',
          `${path}[${key}]`,
          'Array contains non-canonical numeric property',
        );
        return null;
      }
      if (!descriptor || !isDataDescriptor(descriptor)) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${key}]`, 'Array contains accessor property');
        return null;
      }
    } else {
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}.${key}`, 'Array contains accessor property');
        return null;
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}.${key}`, 'Array contains additional property');
        return null;
      }
    }
  }

  const ownSymbols = Object.getOwnPropertySymbols(value);
  for (const symbol of ownSymbols) {
    pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${String(symbol)}]`, 'Array contains symbol property');
    return null;
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (
    !lengthDescriptor ||
    !isDataDescriptor(lengthDescriptor) ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    pushIssue(issues, 'INVALID_ARRAY', path, 'Array length must be a non-negative safe integer');
    return null;
  }

  const expectedLength = lengthDescriptor.value;
  const seenIndices = new Array<boolean>(expectedLength).fill(false);

  for (const key of ownNames) {
    if (key === 'length') continue;
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (index >= expectedLength || String(index) !== key) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${key}]`, 'Array contains non-canonical numeric property');
        return null;
      }
      seenIndices[index] = true;
    }
  }

  for (let i = 0; i < expectedLength; i++) {
    if (!seenIndices[i]) {
      pushIssue(issues, 'INVALID_ARRAY', path, 'Array is sparse');
      return null;
    }
  }

  return Array.from(value);
}

function assertFinite(value: unknown, path: string, issues: MLBModelFitEvaluationIssue[]): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushIssue(issues, 'NUMERICAL_FAILURE', path, 'Non-finite numerical value encountered');
    return false;
  }
  if (value === 0 && 1 / value === -Infinity) {
    pushIssue(issues, 'NUMERICAL_FAILURE', path, 'Negative zero encountered');
    return false;
  }
  return true;
}

function stableSigmoid(score: number): number {
  if (score >= 0) {
    const clamped = Math.min(score, 500);
    return 1 / (1 + Math.exp(-clamped));
  }
  const clamped = Math.max(score, -500);
  return Math.exp(clamped) / (1 + Math.exp(clamped));
}

function calculateLogLoss(probability: number, target: number): number {
  const clamped = Math.max(1e-15, Math.min(1 - 1e-15, probability));
  return -(target * Math.log(clamped) + (1 - target) * Math.log(1 - clamped));
}

function sumOfSquaredCoefficients(
  coefficients: readonly MLBModelCoefficient[],
): number {
  let sum = 0;
  for (const coeff of coefficients) {
    sum += coeff.valueCoefficient * coeff.valueCoefficient;
    sum += coeff.missingIndicatorCoefficient * coeff.missingIndicatorCoefficient;
  }
  return sum;
}

export type MLBDeterministicLogisticRegressionModelFitOutcome =
  | Readonly<{
      ok: true;
      value: {
        coefficients: MLBModelCoefficient[];
        intercept: number;
        iterationsCompleted: number;
        converged: boolean;
        finalTrainingObjective: number;
        trainingRowCount: number;
        featureIds: readonly string[];
      };
    }>
  | Readonly<{
      ok: false;
      issues: MLBModelFitEvaluationIssue[];
    }>;

export function fitMLBDeterministicLogisticRegressionModel(
  configuration: MLBModelTrainingConfiguration,
  featureIds: readonly string[],
  trainRows: readonly MLBTrainingMatrixRow[],
): MLBDeterministicLogisticRegressionModelFitOutcome {
  const issues: MLBModelFitEvaluationIssue[] = [];

  const learningRate = configuration.optimization.learningRate;
  const maxIterations = configuration.optimization.maxIterations;
  const tolerance = configuration.optimization.tolerance;
  const l2Strength = configuration.regularization.strength;
  const featureCount = featureIds.length;

  const intercept = 0;
  const coefficients: MLBModelCoefficient[] = [];
  for (const featureId of featureIds) {
    coefficients.push({
      featureId,
      valueCoefficient: 0,
      missingIndicatorCoefficient: 0,
    });
  }

  let currentIntercept = intercept;
  const currentValueCoefficients = new Array<number>(featureCount).fill(0);
  const currentMissingCoefficients = new Array<number>(featureCount).fill(0);

  let iterationsCompleted = 0;
  let converged = false;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const gradientsInterceptParts: number[] = [];
    const gradientsValueParts: number[][] = [];
    const gradientsMissingParts: number[][] = [];

    for (let f = 0; f < featureCount; f++) {
      gradientsValueParts[f] = [];
      gradientsMissingParts[f] = [];
    }

    for (const row of trainRows) {
      const vector = row.vector;
      const featureValues: number[] = [];
      const missingFlags: number[] = [];
      for (const val of vector.values) {
        featureValues.push(val.value);
        missingFlags.push(val.wasMissing ? 1 : 0);
      }

      let score = currentIntercept;
      for (let f = 0; f < featureCount; f++) {
        score += currentValueCoefficients[f] * featureValues[f];
        score += currentMissingCoefficients[f] * missingFlags[f];
      }

      if (!assertFinite(score, '$.score', issues)) {
        return { ok: false, issues: sortIssues(issues) };
      }

      const probability = stableSigmoid(score);
      if (!assertFinite(probability, '$.probability', issues)) {
        return { ok: false, issues: sortIssues(issues) };
      }

      const error = probability - row.targetValue;
      if (!assertFinite(error, '$.error', issues)) {
        return { ok: false, issues: sortIssues(issues) };
      }

      gradientsInterceptParts.push(error);
      for (let f = 0; f < featureCount; f++) {
        gradientsValueParts[f].push(error * featureValues[f]);
        gradientsMissingParts[f].push(error * missingFlags[f]);
      }
    }

    const trainSize = trainRows.length;
    const gradientIntercept = gradientsInterceptParts.reduce((a, b) => a + b, 0) / trainSize;
    const gradientValues: number[] = [];
    const gradientMissing: number[] = [];
    for (let f = 0; f < featureCount; f++) {
      const gv = gradientsValueParts[f].reduce((a, b) => a + b, 0) / trainSize + l2Strength * currentValueCoefficients[f];
      const gm = gradientsMissingParts[f].reduce((a, b) => a + b, 0) / trainSize + l2Strength * currentMissingCoefficients[f];
      if (!assertFinite(gv, `$.gradientValues[${f}]`, issues)) {
        return { ok: false, issues: sortIssues(issues) };
      }
      if (!assertFinite(gm, `$.gradientMissing[${f}]`, issues)) {
        return { ok: false, issues: sortIssues(issues) };
      }
      gradientValues.push(gv);
      gradientMissing.push(gm);
    }

    const updateIntercept = currentIntercept - learningRate * gradientIntercept;
    const updateValues: number[] = [];
    const updateMissing: number[] = [];
    for (let f = 0; f < featureCount; f++) {
      const uv = currentValueCoefficients[f] - learningRate * gradientValues[f];
      const um = currentMissingCoefficients[f] - learningRate * gradientMissing[f];
      if (!assertFinite(uv, `$.updateValues[${f}]`, issues)) {
        return { ok: false, issues: sortIssues(issues) };
      }
      if (!assertFinite(um, `$.updateMissing[${f}]`, issues)) {
        return { ok: false, issues: sortIssues(issues) };
      }
      updateValues.push(uv);
      updateMissing.push(um);
    }

    let maxUpdate = 0;
    const absUpdateIntercept = Math.abs(updateIntercept - currentIntercept);
    if (absUpdateIntercept > maxUpdate) maxUpdate = absUpdateIntercept;
    for (let f = 0; f < featureCount; f++) {
      const absUpdateValue = Math.abs(updateValues[f] - currentValueCoefficients[f]);
      const absUpdateMissing = Math.abs(updateMissing[f] - currentMissingCoefficients[f]);
      if (absUpdateValue > maxUpdate) maxUpdate = absUpdateValue;
      if (absUpdateMissing > maxUpdate) maxUpdate = absUpdateMissing;
    }
    if (!assertFinite(maxUpdate, '$.maxUpdate', issues)) {
      return { ok: false, issues: sortIssues(issues) };
    }

    currentIntercept = updateIntercept === 0 ? 0 : updateIntercept;
    for (let f = 0; f < featureCount; f++) {
      currentValueCoefficients[f] = updateValues[f] === 0 ? 0 : updateValues[f];
      currentMissingCoefficients[f] = updateMissing[f] === 0 ? 0 : updateMissing[f];
    }

    iterationsCompleted = iteration + 1;

    if (maxUpdate <= tolerance) {
      converged = true;
      break;
    }
  }

  let finalObjective = 0;
  for (const row of trainRows) {
    const vector = row.vector;
    let score = currentIntercept;
    for (let f = 0; f < featureCount; f++) {
      score += currentValueCoefficients[f] * vector.values[f].value;
      score += currentMissingCoefficients[f] * (vector.values[f].wasMissing ? 1 : 0);
    }
    if (!assertFinite(score, '$.finalScore', issues)) {
      return { ok: false, issues: sortIssues(issues) };
    }
    const probability = stableSigmoid(score);
    if (!assertFinite(probability, '$.finalProbability', issues)) {
      return { ok: false, issues: sortIssues(issues) };
    }
    finalObjective += calculateLogLoss(probability, row.targetValue);
  }
  const computedFinalObjective = finalObjective / trainRows.length + 0.5 * l2Strength * sumOfSquaredCoefficients(coefficients.map((c, i) => ({ ...c, valueCoefficient: currentValueCoefficients[i], missingIndicatorCoefficient: currentMissingCoefficients[i] })));
  if (!assertFinite(computedFinalObjective, '$.finalTrainingObjective', issues)) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const finalCoefficients: MLBModelCoefficient[] = coefficients.map((c, i) => ({
    featureId: c.featureId,
    valueCoefficient: currentValueCoefficients[i] === 0 ? 0 : currentValueCoefficients[i],
    missingIndicatorCoefficient: currentMissingCoefficients[i] === 0 ? 0 : currentMissingCoefficients[i],
  }));

  return {
    ok: true,
    value: {
      intercept: currentIntercept === 0 ? 0 : currentIntercept,
      coefficients: finalCoefficients,
      iterationsCompleted,
      converged,
      finalTrainingObjective: computedFinalObjective,
      trainingRowCount: trainRows.length,
      featureIds,
    },
  };
}

export function predictMLBHomeWinProbability(
  model: MLBDeterministicLogisticRegressionModel,
  vector: MLBFeatureVector,
): number {
  let score = model.intercept;
  for (let f = 0; f < model.featureIds.length; f++) {
    score += model.coefficients[f].valueCoefficient * vector.values[f].value;
    score += model.coefficients[f].missingIndicatorCoefficient * (vector.values[f].wasMissing ? 1 : 0);
  }
  return stableSigmoid(score);
}

export function validateMLBDeterministicLogisticRegressionModel(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBDeterministicLogisticRegressionModel;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelFitEvaluationIssue[];
    }> {
  const issues: MLBModelFitEvaluationIssue[] = [];

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushUniquePathCode(
              issues,
              {
                code: 'ODDS_CONTAMINATION',
                path: `$${firewallPath.replace(/^\./, '')}`,
                message: `Model contains prohibited field at ${firewallPath}`,
              },
            );
          }
        }
      } else if (
        error.name === 'UninspectableAccessorPropertyError' &&
        error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
      ) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushUniquePathCode(
              issues,
              {
                code: 'INVALID_JSON_VALUE',
                path: `$${accessorPath.replace(/^\./, '')}`,
                message: 'Model contains an accessor property',
              },
            );
          }
        }
      }
    }
  }

  if (!isPlainObject(value)) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;
  validateModelRoot(root, issues);

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBDeterministicLogisticRegressionModel };
}

export function validateMLBModelValidationEvaluation(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelValidationEvaluation;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelFitEvaluationIssue[];
    }> {
  const issues: MLBModelFitEvaluationIssue[] = [];

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushUniquePathCode(
              issues,
              {
                code: 'ODDS_CONTAMINATION',
                path: `$${firewallPath.replace(/^\./, '')}`,
                message: `Evaluation contains prohibited field at ${firewallPath}`,
              },
            );
          }
        }
      } else if (
        error.name === 'UninspectableAccessorPropertyError' &&
        error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
      ) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushUniquePathCode(
              issues,
              {
                code: 'INVALID_JSON_VALUE',
                path: `$${accessorPath.replace(/^\./, '')}`,
                message: 'Evaluation contains an accessor property',
              },
            );
          }
        }
      }
    }
  }

  if (!isPlainObject(value)) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;
  validateEvaluationRoot(root, issues);

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBModelValidationEvaluation };
}

export function validateMLBModelFitValidationResult(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelFitValidationResult;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelFitEvaluationIssue[];
    }> {
  const issues: MLBModelFitEvaluationIssue[] = [];

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushUniquePathCode(
              issues,
              {
                code: 'ODDS_CONTAMINATION',
                path: `$${firewallPath.replace(/^\./, '')}`,
                message: `Result contains prohibited field at ${firewallPath}`,
              },
            );
          }
        }
      } else if (
        error.name === 'UninspectableAccessorPropertyError' &&
        error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
      ) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushUniquePathCode(
              issues,
              {
                code: 'INVALID_JSON_VALUE',
                path: `$${accessorPath.replace(/^\./, '')}`,
                message: 'Result contains an accessor property',
              },
            );
          }
        }
      }
    }
  }

  if (!isPlainObject(value)) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;
  validateResultRoot(root, issues);

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBModelFitValidationResult };
}

function deriveFeatureSchema(
  matrix: MLBTrainingMatrix,
): readonly string[] {
  const firstRow = matrix.rows[0];
  return firstRow.vector.values.map((v) => v.featureId);
}

function classVariation(
  rows: readonly MLBTrainingMatrixRow[],
  split: 'TRAIN' | 'VALIDATION',
): boolean {
  let hasPositive = false;
  let hasNegative = false;
  for (const row of rows) {
    if (row.split !== split) continue;
    const target = row.targetValue;
    if (target === 1) hasPositive = true;
    else if (target === 0) hasNegative = true;
    if (hasPositive && hasNegative) return true;
  }
  return false;
}

function calculateValidationMetrics(
  probabilities: number[],
  targets: number[],
): MLBValidationMetricValues {
  const n = probabilities.length;
  let logLossSum = 0;
  let brierSum = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let rocSum = 0;

  for (let i = 0; i < n; i++) {
    const prob = probabilities[i];
    const target = targets[i];
    logLossSum += calculateLogLoss(prob, target);
    brierSum += (prob - target) * (prob - target);
    if (target === 1) positiveCount++;
    else negativeCount++;
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (targets[i] === 1 && targets[j] === 0) {
        if (probabilities[i] > probabilities[j]) rocSum += 1;
        else if (probabilities[i] === probabilities[j]) rocSum += 0.5;
      } else if (targets[i] === 0 && targets[j] === 1) {
        if (probabilities[i] < probabilities[j]) rocSum += 1;
        else if (probabilities[i] === probabilities[j]) rocSum += 0.5;
      }
    }
  }

  const logLoss = logLossSum / n;
  const brierScore = brierSum / n;
  const rocAuc = positiveCount > 0 && negativeCount > 0 ? rocSum / (positiveCount * negativeCount) : 0;

  return { logLoss, brierScore, rocAuc };
}

function runCrossContractionChecks(
  configuration: MLBModelTrainingConfiguration,
  plan: MLBModelEvaluationPlan,
  matrix: MLBTrainingMatrix,
  issues: MLBModelFitEvaluationIssue[],
): void {
  if (configuration.configId !== plan.configId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.configId', 'configuration.configId must equal evaluationPlan.configId');
  }
  if (configuration.algorithm !== plan.algorithm) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.algorithm', 'configuration.algorithm must equal evaluationPlan.algorithm');
  }
  if (configuration.sport !== plan.sport || configuration.target !== plan.target || configuration.targetEncoding !== plan.targetEncoding) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$', 'configuration and evaluation plan must agree on sport, target, and targetEncoding');
  }

  if (plan.matrixId !== matrix.matrixId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.matrixId', 'evaluationPlan.matrixId must equal trainingMatrix.matrixId');
  }
  if (plan.manifestId !== matrix.manifestId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.manifestId', 'evaluationPlan.manifestId must equal trainingMatrix.manifestId');
  }
  if (plan.datasetId !== matrix.datasetId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.datasetId', 'evaluationPlan.datasetId must equal trainingMatrix.datasetId');
  }

  const matrixFeatureIds = deriveFeatureSchema(matrix);
  if (plan.featureIds.length !== matrixFeatureIds.length) {
    pushIssue(issues, 'FEATURE_SCHEMA_MISMATCH', '$.featureIds', 'Plan featureIds length must equal matrix feature schema length');
  } else {
    for (let i = 0; i < plan.featureIds.length; i++) {
      if (plan.featureIds[i] !== matrixFeatureIds[i]) {
        pushIssue(issues, 'FEATURE_SCHEMA_MISMATCH', `$.featureIds[${i}]`, `Plan featureId ${plan.featureIds[i]} must equal matrix featureId ${matrixFeatureIds[i]}`);
        break;
      }
    }
  }

  const matrixSplitPolicy = matrix.splitPolicy;
  const planSplitPolicy = plan.splitPolicy;
  if (
    matrixSplitPolicy.strategy !== planSplitPolicy.strategy ||
    matrixSplitPolicy.embargoDays !== planSplitPolicy.embargoDays ||
    matrixSplitPolicy.train.startDate !== planSplitPolicy.train.startDate ||
    matrixSplitPolicy.train.endDate !== planSplitPolicy.train.endDate ||
    matrixSplitPolicy.validation.startDate !== planSplitPolicy.validation.startDate ||
    matrixSplitPolicy.validation.endDate !== planSplitPolicy.validation.endDate ||
    matrixSplitPolicy.test.startDate !== planSplitPolicy.test.startDate ||
    matrixSplitPolicy.test.endDate !== planSplitPolicy.test.endDate
  ) {
    pushIssue(issues, 'SPLIT_POLICY_MISMATCH', '$.splitPolicy', 'Plan splitPolicy must equal matrix splitPolicy');
  }

  const matrixSplitCounts = matrix.splitCounts;
  const planSplitCounts = plan.splitCounts;
  if (
    matrixSplitCounts.train !== planSplitCounts.train ||
    matrixSplitCounts.validation !== planSplitCounts.validation ||
    matrixSplitCounts.test !== planSplitCounts.test
  ) {
    pushIssue(issues, 'SPLIT_COUNT_MISMATCH', '$.splitCounts', 'Plan splitCounts must equal matrix splitCounts');
  }

  if (plan.totalRows !== matrix.rows.length) {
    pushIssue(issues, 'SPLIT_COUNT_MISMATCH', '$.totalRows', 'Plan totalRows must equal matrix row count');
  }
}

export function fitAndEvaluateMLBDeterministicLogisticRegression(
  configuration: unknown,
  evaluationPlan: unknown,
  trainingMatrix: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelFitValidationResult;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelFitEvaluationIssue[];
    }> {
  const issues: MLBModelFitEvaluationIssue[] = [];

  const configResult = validateMLBModelTrainingConfiguration(configuration);
  if (!configResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'CONFIGURATION_INVALID',
          path: '$.configuration',
          message: `Configuration invalid: ${configResult.issues[0]?.code ?? 'unknown'} at ${configResult.issues[0]?.path ?? '$'}`,
        },
      ],
    };
  }

  const planResult = validateMLBModelEvaluationPlan(evaluationPlan);
  if (!planResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'PLAN_INVALID',
          path: '$.evaluationPlan',
          message: `Evaluation plan invalid: ${planResult.issues[0]?.code ?? 'unknown'} at ${planResult.issues[0]?.path ?? '$'}`,
        },
      ],
    };
  }

  const matrixResult = validateMLBTrainingMatrix(trainingMatrix);
  if (!matrixResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'MATRIX_INVALID',
          path: '$.trainingMatrix',
          message: `Training matrix invalid: ${matrixResult.issues[0]?.code ?? 'unknown'} at ${matrixResult.issues[0]?.path ?? '$'}`,
        },
      ],
    };
  }

  const validatedConfig = configResult.value;
  const validatedPlan = planResult.value;
  const validatedMatrix = matrixResult.value;

  runCrossContractionChecks(validatedConfig, validatedPlan, validatedMatrix, issues);
  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const featureIds = deriveFeatureSchema(validatedMatrix);
  const trainRows: MLBTrainingMatrixRow[] = [];
  const validationRows: MLBTrainingMatrixRow[] = [];

  for (const row of validatedMatrix.rows) {
    if (row.split === 'TRAIN') {
      trainRows.push(row);
    } else if (row.split === 'VALIDATION') {
      validationRows.push(row);
    }
  }

  if (trainRows.length === 0) {
    return {
      ok: false,
      issues: [
        {
          code: 'INSUFFICIENT_CLASS_VARIATION',
          path: '$.trainingMatrix.rows',
          message: 'TRAIN split must contain at least one target 0 and one target 1',
        },
      ],
    };
  }

  if (!classVariation(validatedMatrix.rows, 'TRAIN')) {
    return {
      ok: false,
      issues: [
        {
          code: 'INSUFFICIENT_CLASS_VARIATION',
          path: '$.trainingMatrix.rows',
          message: 'TRAIN split must contain at least one target 0 and one target 1',
        },
      ],
    };
  }

  if (!classVariation(validatedMatrix.rows, 'VALIDATION')) {
    return {
      ok: false,
      issues: [
        {
          code: 'INSUFFICIENT_CLASS_VARIATION',
          path: '$.trainingMatrix.rows',
          message: 'VALIDATION split must contain at least one target 0 and one target 1',
        },
      ],
    };
  }

  const modelResult = fitMLBDeterministicLogisticRegressionModel(
    validatedConfig,
    featureIds,
    trainRows,
  );
  if (!modelResult.ok) {
    return { ok: false, issues: modelResult.issues };
  }
  const modelValue = modelResult.value;

  const model: MLBDeterministicLogisticRegressionModel = {
    contractVersion: MLB_LOGISTIC_REGRESSION_MODEL_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    modelId: `${validatedPlan.planId}::model-v1`,
    planId: validatedPlan.planId,
    matrixId: validatedMatrix.matrixId,
    configId: validatedConfig.configId,
    manifestId: validatedMatrix.manifestId,
    datasetId: validatedMatrix.datasetId,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    featureIds: modelValue.featureIds,
    intercept: modelValue.intercept,
    coefficients: modelValue.coefficients,
    trainingRowCount: modelValue.trainingRowCount,
    iterationsCompleted: modelValue.iterationsCompleted,
    converged: modelValue.converged,
    finalTrainingObjective: modelValue.finalTrainingObjective,
  };

  const validationProbabilities: number[] = [];
  const validationTargets: number[] = [];
  for (const row of validationRows) {
    const probability = predictMLBHomeWinProbability(model, row.vector);
    if (!assertFinite(probability, '$.validationProbability', issues)) {
      return { ok: false, issues: sortIssues(issues) };
    }
    validationProbabilities.push(probability);
    validationTargets.push(row.targetValue);
  }

  const metrics = calculateValidationMetrics(validationProbabilities, validationTargets);
  if (!assertFinite(metrics.logLoss, '$.metrics.logLoss', issues)) {
    return { ok: false, issues: sortIssues(issues) };
  }
  if (!assertFinite(metrics.brierScore, '$.metrics.brierScore', issues)) {
    return { ok: false, issues: sortIssues(issues) };
  }
  if (!assertFinite(metrics.rocAuc, '$.metrics.rocAuc', issues)) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const evaluation: MLBModelValidationEvaluation = {
    contractVersion: MLB_VALIDATION_EVALUATION_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: `${model.modelId}::validation-v1`,
    modelId: model.modelId,
    planId: validatedPlan.planId,
    matrixId: validatedMatrix.matrixId,
    configId: validatedConfig.configId,
    split: 'VALIDATION',
    rowCount: validationRows.length,
    metrics,
  };

  const result: MLBModelFitValidationResult = {
    contractVersion: MLB_FIT_VALIDATION_RESULT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    resultId: `${model.planId}::fit-validation-v1`,
    model,
    validation: evaluation,
  };

  const validationModelResult = validateMLBDeterministicLogisticRegressionModel(model);
  if (!validationModelResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'MODEL_INVALID',
          path: '$.model',
          message: `Generated model invalid: ${validationModelResult.issues[0]?.code ?? 'unknown'} at ${validationModelResult.issues[0]?.path ?? '$'}`,
        },
      ],
    };
  }

  const validationEvaluationResult = validateMLBModelValidationEvaluation(evaluation);
  if (!validationEvaluationResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'EVALUATION_INVALID',
          path: '$.validation',
          message: `Generated evaluation invalid: ${validationEvaluationResult.issues[0]?.code ?? 'unknown'} at ${validationEvaluationResult.issues[0]?.path ?? '$'}`,
        },
      ],
    };
  }

  const validationResult = validateMLBModelFitValidationResult(result);
  if (!validationResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'GENERATED_RESULT_INVALID',
          path: '$',
          message: `Generated result invalid: ${validationResult.issues[0]?.code ?? 'unknown'} at ${validationResult.issues[0]?.path ?? '$'}`,
        },
      ],
    };
  }

  try {
    assertNoOddsContamination(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        return {
          ok: false,
          issues: [
            {
              code: 'ODDS_CONTAMINATION',
              path: '$',
              message: 'Generated result contains odds contamination',
            },
          ],
        };
      }
      if (error.name === 'UninspectableAccessorPropertyError') {
        return {
          ok: false,
          issues: [
            {
              code: 'INVALID_JSON_VALUE',
              path: '$',
              message: 'Generated result contains an accessor property',
            },
          ],
        };
      }
    }
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_JSON_VALUE',
          path: '$',
          message: 'Generated result contains uninspectable accessor',
        },
      ],
    };
  }

  return { ok: true, value: validationResult.value };
}
