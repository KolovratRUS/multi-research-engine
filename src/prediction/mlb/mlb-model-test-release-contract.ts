import {
  assertNoOddsContamination,
} from '../firewall/odds-contamination-guard';
import {
  validateMLBTrainingMatrix,
  type MLBTrainingMatrix,
  type MLBTrainingMatrixRow,
} from './mlb-training-matrix-contract';
import {
  validateMLBModelEvaluationPlan,
  type MLBModelEvaluationPlan,
} from './mlb-model-training-plan-contract';
import {
  validateMLBModelFitValidationResult,
  type MLBDeterministicLogisticRegressionModel,
  type MLBModelFitValidationResult,
} from './mlb-logistic-regression-fit-contract';

export const MLB_TEST_EVALUATION_CONTRACT_VERSION =
  'mlb-model-test-evaluation-v1' as const;

export const MLB_MODEL_RELEASE_CONTRACT_VERSION =
  'mlb-model-release-v1' as const;

export const MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION =
  'mlb-model-test-release-result-v1' as const;

export type MLBModelReleaseStatus =
  'OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED';

export type MLBTestMetricValues = Readonly<{
  logLoss: number;
  brierScore: number;
  rocAuc: number;
}>;

export type MLBModelTestEvaluation = Readonly<{
  contractVersion: typeof MLB_TEST_EVALUATION_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  evaluationId: string;
  modelId: string;
  planId: string;
  matrixId: string;
  configId: string;
  split: 'TEST';
  rowCount: number;
  metrics: MLBTestMetricValues;
}>;

export type MLBModelReleaseRecord = Readonly<{
  contractVersion: typeof MLB_MODEL_RELEASE_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  releaseId: string;
  modelId: string;
  planId: string;
  matrixId: string;
  configId: string;
  manifestId: string;
  datasetId: string;
  algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1';
  validationEvaluationId: string;
  testEvaluationId: string;
  configurationLockStatus: 'LOCKED_BEFORE_TEST_EVALUATION';
  testEvaluationPolicy: 'HELD_OUT_TEST_FINAL_EVALUATION_V1';
  releaseStatus: MLBModelReleaseStatus;
}>;

export type MLBModelTestReleaseResult = Readonly<{
  contractVersion: typeof MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  resultId: string;
  fitValidation: MLBModelFitValidationResult;
  test: MLBModelTestEvaluation;
  release: MLBModelReleaseRecord;
}>;

export type MLBModelTestReleaseIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'DUPLICATE_ID'
    | 'NON_CANONICAL_ORDER'
    | 'FIT_VALIDATION_RESULT_INVALID'
    | 'PLAN_INVALID'
    | 'MATRIX_INVALID'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'FEATURE_SCHEMA_MISMATCH'
    | 'SPLIT_POLICY_MISMATCH'
    | 'SPLIT_COUNT_MISMATCH'
    | 'HOLDOUT_POLICY_MISMATCH'
    | 'INSUFFICIENT_TEST_CLASS_VARIATION'
    | 'NUMERICAL_FAILURE'
    | 'TEST_EVALUATION_ID_MISMATCH'
    | 'RELEASE_ID_MISMATCH'
    | 'RESULT_ID_MISMATCH'
    | 'TEST_EVALUATION_INVALID'
    | 'RELEASE_RECORD_INVALID'
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
  return descriptor !== undefined && Object.prototype.hasOwnProperty.call(descriptor, 'value');
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
  issues: MLBModelTestReleaseIssue[],
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
  issues: MLBModelTestReleaseIssue[],
  code: MLBModelTestReleaseIssue['code'],
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
  issues: MLBModelTestReleaseIssue[],
  next: MLBModelTestReleaseIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

function sortIssues(
  issues: MLBModelTestReleaseIssue[],
): MLBModelTestReleaseIssue[] {
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
  issues: MLBModelTestReleaseIssue[],
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
): string | MLBModelTestReleaseIssue {
  if (!isStrictNonEmptyTrimmedString(value)) {
    return { code: 'INVALID_STRING', path, message: `${label} must be a valid identifier` };
  }
  return value;
}

const PROHIBITED_TEST_EVALUATION_FIELDS = new Set([
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
  'threshold',
  'confusionMatrix',
  'validationRows',
  'trainRows',
]);

const KNOWN_TEST_EVALUATION_ROOT_FIELDS = new Set([
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

const KNOWN_TEST_METRIC_FIELDS = new Set(['logLoss', 'brierScore', 'rocAuc']);

const PROHIBITED_RELEASE_FIELDS = new Set([
  'coefficients',
  'intercept',
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
  'threshold',
  'confusionMatrix',
  'deployment',
  'endpoint',
  'recommendation',
  'multi',
  'stake',
  'grading',
]);

const KNOWN_RELEASE_ROOT_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'releaseId',
  'modelId',
  'planId',
  'matrixId',
  'configId',
  'manifestId',
  'datasetId',
  'algorithm',
  'validationEvaluationId',
  'testEvaluationId',
  'configurationLockStatus',
  'testEvaluationPolicy',
  'releaseStatus',
]);

const PROHIBITED_RESULT_FIELDS = new Set([
  'evaluationPlan',
  'trainingMatrix',
  'configuration',
  'rows',
  'trainRows',
  'validationRows',
  'vectors',
  'values',
  'wasMissing',
  'targets',
  'labels',
  'rowProbabilities',
  'rowPredictions',
  'liveInferenceOutput',
  'deploymentMetadata',
]);

const KNOWN_RESULT_ROOT_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'resultId',
  'fitValidation',
  'test',
  'release',
]);

function validateTestMetricValues(
  value: unknown,
  path: string,
  issues: MLBModelTestReleaseIssue[],
): MLBTestMetricValues | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'metrics must be a plain object');
    return undefined;
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, KNOWN_TEST_METRIC_FIELDS, path, issues);

  const logLossResult = ownDataProperty(root, 'logLoss', `${path}.logLoss`, issues);
  let logLoss: number | undefined;
  if (logLossResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.logLoss`, 'logLoss is required');
  } else if (logLossResult.kind === 'data') {
    if (
      typeof logLossResult.value !== 'number' ||
      !Number.isFinite(logLossResult.value) ||
      logLossResult.value < 0 ||
      (logLossResult.value === 0 && 1 / logLossResult.value === -Infinity)
    ) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.logLoss`, 'logLoss must be a non-negative finite number');
    } else {
      logLoss = logLossResult.value === 0 ? 0 : logLossResult.value;
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
      (brierScoreResult.value === 0 && 1 / brierScoreResult.value === -Infinity)
    ) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.brierScore`, 'brierScore must be between 0 and 1 inclusive');
    } else {
      brierScore = brierScoreResult.value === 0 ? 0 : brierScoreResult.value;
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
      (rocAucResult.value === 0 && 1 / rocAucResult.value === -Infinity)
    ) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.rocAuc`, 'rocAuc must be between 0 and 1 inclusive');
    } else {
      rocAuc = rocAucResult.value === 0 ? 0 : rocAucResult.value;
    }
  }

  if (logLoss !== undefined && brierScore !== undefined && rocAuc !== undefined) {
    return { logLoss, brierScore, rocAuc };
  }

  return undefined;
}

function validateTestEvaluationRoot(
  value: Record<string, unknown>,
  issues: MLBModelTestReleaseIssue[],
): void {
  addKnownFieldIssues(value, KNOWN_TEST_EVALUATION_ROOT_FIELDS, '$', issues);

  for (const key of Object.getOwnPropertyNames(value)) {
    if (PROHIBITED_TEST_EVALUATION_FIELDS.has(key)) {
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
    if (contractVersionResult.value !== MLB_TEST_EVALUATION_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_TEST_EVALUATION_CONTRACT_VERSION}`,
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
    if (splitResult.value !== 'TEST') {
      pushIssue(issues, 'INVALID_LITERAL', '$.split', 'split must be TEST');
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
    validateTestMetricValues(metricsResult.value, '$.metrics', issues);
  }
}

function validateReleaseRecordRoot(
  value: Record<string, unknown>,
  issues: MLBModelTestReleaseIssue[],
): void {
  addKnownFieldIssues(value, KNOWN_RELEASE_ROOT_FIELDS, '$', issues);

  for (const key of Object.getOwnPropertyNames(value)) {
    if (PROHIBITED_RELEASE_FIELDS.has(key)) {
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
    if (contractVersionResult.value !== MLB_MODEL_RELEASE_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_MODEL_RELEASE_CONTRACT_VERSION}`,
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

  const releaseIdResult = ownDataProperty(value, 'releaseId', '$.releaseId', issues);
  if (releaseIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.releaseId', 'releaseId is required');
  } else if (releaseIdResult.kind === 'data') {
    const id = validateIdentifier(releaseIdResult.value, '$.releaseId', 'releaseId');
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

  const validationEvaluationIdResult = ownDataProperty(value, 'validationEvaluationId', '$.validationEvaluationId', issues);
  if (validationEvaluationIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.validationEvaluationId', 'validationEvaluationId is required');
  } else if (validationEvaluationIdResult.kind === 'data') {
    const id = validateIdentifier(validationEvaluationIdResult.value, '$.validationEvaluationId', 'validationEvaluationId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const testEvaluationIdResult = ownDataProperty(value, 'testEvaluationId', '$.testEvaluationId', issues);
  if (testEvaluationIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.testEvaluationId', 'testEvaluationId is required');
  } else if (testEvaluationIdResult.kind === 'data') {
    const id = validateIdentifier(testEvaluationIdResult.value, '$.testEvaluationId', 'testEvaluationId');
    if (typeof id !== 'string') {
      issues.push(id);
    }
  }

  const configurationLockStatusResult = ownDataProperty(value, 'configurationLockStatus', '$.configurationLockStatus', issues);
  if (configurationLockStatusResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.configurationLockStatus', 'configurationLockStatus is required');
  } else if (configurationLockStatusResult.kind === 'data') {
    if (configurationLockStatusResult.value !== 'LOCKED_BEFORE_TEST_EVALUATION') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.configurationLockStatus',
        'configurationLockStatus must be LOCKED_BEFORE_TEST_EVALUATION',
      );
    }
  }

  const testEvaluationPolicyResult = ownDataProperty(value, 'testEvaluationPolicy', '$.testEvaluationPolicy', issues);
  if (testEvaluationPolicyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.testEvaluationPolicy', 'testEvaluationPolicy is required');
  } else if (testEvaluationPolicyResult.kind === 'data') {
    if (testEvaluationPolicyResult.value !== 'HELD_OUT_TEST_FINAL_EVALUATION_V1') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.testEvaluationPolicy',
        'testEvaluationPolicy must be HELD_OUT_TEST_FINAL_EVALUATION_V1',
      );
    }
  }

  const releaseStatusResult = ownDataProperty(value, 'releaseStatus', '$.releaseStatus', issues);
  if (releaseStatusResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.releaseStatus', 'releaseStatus is required');
  } else if (releaseStatusResult.kind === 'data') {
    if (releaseStatusResult.value !== 'OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.releaseStatus',
        'releaseStatus must be OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED',
      );
    }
  }
}

function validateResultRoot(
  value: Record<string, unknown>,
  issues: MLBModelTestReleaseIssue[],
): void {
  addKnownFieldIssues(value, KNOWN_RESULT_ROOT_FIELDS, '$', issues);

  for (const key of Object.getOwnPropertyNames(value)) {
    if (PROHIBITED_RESULT_FIELDS.has(key)) {
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
    if (contractVersionResult.value !== MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION}`,
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

  const fitValidationResult = ownDataProperty(value, 'fitValidation', '$.fitValidation', issues);
  if (fitValidationResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.fitValidation', 'fitValidation is required');
  } else if (fitValidationResult.kind === 'accessor') {
    pushIssue(issues, 'INVALID_JSON_VALUE', '$.fitValidation', 'fitValidation is an accessor property');
  } else if (fitValidationResult.kind === 'data') {
    if (!isPlainObject(fitValidationResult.value)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.fitValidation', 'fitValidation must be a plain object');
    }
  }

  const testResult = ownDataProperty(value, 'test', '$.test', issues);
  if (testResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.test', 'test is required');
  } else if (testResult.kind === 'accessor') {
    pushIssue(issues, 'INVALID_JSON_VALUE', '$.test', 'test is an accessor property');
  } else if (testResult.kind === 'data') {
    if (!isPlainObject(testResult.value)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.test', 'test must be a plain object');
    }
  }

  const releaseResult = ownDataProperty(value, 'release', '$.release', issues);
  if (releaseResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.release', 'release is required');
  } else if (releaseResult.kind === 'accessor') {
    pushIssue(issues, 'INVALID_JSON_VALUE', '$.release', 'release is an accessor property');
  } else if (releaseResult.kind === 'data') {
    if (!isPlainObject(releaseResult.value)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.release', 'release must be a plain object');
    }
  }
}

function stableSigmoid(score: number): number {
  if (score >= 0) {
    const clamped = Math.min(score, 500);
    return 1 / (1 + Math.exp(-clamped));
  }
  const clamped = Math.max(score, -500);
  return Math.exp(clamped) / (1 + Math.exp(clamped));
}

function stableLogLoss(probability: number, target: number): number {
  const clamped = Math.max(1e-15, Math.min(1 - 1e-15, probability));
  return -(target * Math.log(clamped) + (1 - target) * Math.log(1 - clamped));
}

function normalizeNegativeZero(value: number): number {
  return value === 0 ? 0 : value;
}

function validateTestEvaluation(
  value: unknown,
  issues: MLBModelTestReleaseIssue[],
): MLBModelTestEvaluation | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'TEST evaluation must be a plain object');
    return undefined;
  }

  const root = value as Record<string, unknown>;
  validateTestEvaluationRoot(root, issues);

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  const targetEncodingResult = ownDataProperty(root, 'targetEncoding', '$.targetEncoding', issues);
  const evaluationIdResult = ownDataProperty(root, 'evaluationId', '$.evaluationId', issues);
  const modelIdResult = ownDataProperty(root, 'modelId', '$.modelId', issues);
  const planIdResult = ownDataProperty(root, 'planId', '$.planId', issues);
  const matrixIdResult = ownDataProperty(root, 'matrixId', '$.matrixId', issues);
  const configIdResult = ownDataProperty(root, 'configId', '$.configId', issues);
  const splitResult = ownDataProperty(root, 'split', '$.split', issues);
  const rowCountResult = ownDataProperty(root, 'rowCount', '$.rowCount', issues);
  const metricsResult = ownDataProperty(root, 'metrics', '$.metrics', issues);

  if (
    contractVersionResult.kind !== 'data' || contractVersionResult.value !== MLB_TEST_EVALUATION_CONTRACT_VERSION ||
    sportResult.kind !== 'data' || sportResult.value !== 'MLB' ||
    targetResult.kind !== 'data' || targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER' ||
    targetEncodingResult.kind !== 'data' || targetEncodingResult.value !== 'HOME_WIN_1_AWAY_WIN_0' ||
    evaluationIdResult.kind !== 'data' || typeof evaluationIdResult.value !== 'string' ||
    modelIdResult.kind !== 'data' || typeof modelIdResult.value !== 'string' ||
    planIdResult.kind !== 'data' || typeof planIdResult.value !== 'string' ||
    matrixIdResult.kind !== 'data' || typeof matrixIdResult.value !== 'string' ||
    configIdResult.kind !== 'data' || typeof configIdResult.value !== 'string' ||
    splitResult.kind !== 'data' || splitResult.value !== 'TEST' ||
    rowCountResult.kind !== 'data' ||
    !Number.isSafeInteger(rowCountResult.value as number) ||
    (rowCountResult.value as number) <= 0 ||
    metricsResult.kind !== 'data'
  ) {
    return undefined;
  }

  const metrics = validateTestMetricValues(metricsResult.value, '$.metrics', issues);
  if (!metrics) {
    return undefined;
  }

  return {
    contractVersion: MLB_TEST_EVALUATION_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: evaluationIdResult.value as string,
    modelId: modelIdResult.value as string,
    planId: planIdResult.value as string,
    matrixId: matrixIdResult.value as string,
    configId: configIdResult.value as string,
    split: 'TEST',
    rowCount: rowCountResult.value as number,
    metrics,
  };
}

function validateReleaseRecord(
  value: unknown,
  issues: MLBModelTestReleaseIssue[],
): MLBModelReleaseRecord | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Release record must be a plain object');
    return undefined;
  }

  const root = value as Record<string, unknown>;
  validateReleaseRecordRoot(root, issues);

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  const targetEncodingResult = ownDataProperty(root, 'targetEncoding', '$.targetEncoding', issues);
  const releaseIdResult = ownDataProperty(root, 'releaseId', '$.releaseId', issues);
  const modelIdResult = ownDataProperty(root, 'modelId', '$.modelId', issues);
  const planIdResult = ownDataProperty(root, 'planId', '$.planId', issues);
  const matrixIdResult = ownDataProperty(root, 'matrixId', '$.matrixId', issues);
  const configIdResult = ownDataProperty(root, 'configId', '$.configId', issues);
  const manifestIdResult = ownDataProperty(root, 'manifestId', '$.manifestId', issues);
  const datasetIdResult = ownDataProperty(root, 'datasetId', '$.datasetId', issues);
  const algorithmResult = ownDataProperty(root, 'algorithm', '$.algorithm', issues);
  const validationEvaluationIdResult = ownDataProperty(root, 'validationEvaluationId', '$.validationEvaluationId', issues);
  const testEvaluationIdResult = ownDataProperty(root, 'testEvaluationId', '$.testEvaluationId', issues);
  const configurationLockStatusResult = ownDataProperty(root, 'configurationLockStatus', '$.configurationLockStatus', issues);
  const testEvaluationPolicyResult = ownDataProperty(root, 'testEvaluationPolicy', '$.testEvaluationPolicy', issues);
  const releaseStatusResult = ownDataProperty(root, 'releaseStatus', '$.releaseStatus', issues);

  if (
    contractVersionResult.kind !== 'data' || contractVersionResult.value !== MLB_MODEL_RELEASE_CONTRACT_VERSION ||
    sportResult.kind !== 'data' || sportResult.value !== 'MLB' ||
    targetResult.kind !== 'data' || targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER' ||
    targetEncodingResult.kind !== 'data' || targetEncodingResult.value !== 'HOME_WIN_1_AWAY_WIN_0' ||
    releaseIdResult.kind !== 'data' || typeof releaseIdResult.value !== 'string' ||
    modelIdResult.kind !== 'data' || typeof modelIdResult.value !== 'string' ||
    planIdResult.kind !== 'data' || typeof planIdResult.value !== 'string' ||
    matrixIdResult.kind !== 'data' || typeof matrixIdResult.value !== 'string' ||
    configIdResult.kind !== 'data' || typeof configIdResult.value !== 'string' ||
    manifestIdResult.kind !== 'data' || typeof manifestIdResult.value !== 'string' ||
    datasetIdResult.kind !== 'data' || typeof datasetIdResult.value !== 'string' ||
    algorithmResult.kind !== 'data' || algorithmResult.value !== 'L2_LOGISTIC_REGRESSION_BINARY_V1' ||
    validationEvaluationIdResult.kind !== 'data' || typeof validationEvaluationIdResult.value !== 'string' ||
    testEvaluationIdResult.kind !== 'data' || typeof testEvaluationIdResult.value !== 'string' ||
    configurationLockStatusResult.kind !== 'data' || configurationLockStatusResult.value !== 'LOCKED_BEFORE_TEST_EVALUATION' ||
    testEvaluationPolicyResult.kind !== 'data' || testEvaluationPolicyResult.value !== 'HELD_OUT_TEST_FINAL_EVALUATION_V1' ||
    releaseStatusResult.kind !== 'data' || releaseStatusResult.value !== 'OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED'
  ) {
    return undefined;
  }

  return {
    contractVersion: MLB_MODEL_RELEASE_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    releaseId: releaseIdResult.value as string,
    modelId: modelIdResult.value as string,
    planId: planIdResult.value as string,
    matrixId: matrixIdResult.value as string,
    configId: configIdResult.value as string,
    manifestId: manifestIdResult.value as string,
    datasetId: datasetIdResult.value as string,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    validationEvaluationId: validationEvaluationIdResult.value as string,
    testEvaluationId: testEvaluationIdResult.value as string,
    configurationLockStatus: 'LOCKED_BEFORE_TEST_EVALUATION',
    testEvaluationPolicy: 'HELD_OUT_TEST_FINAL_EVALUATION_V1',
    releaseStatus: 'OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED',
  };
}

function validateCombinedResult(
  value: unknown,
  issues: MLBModelTestReleaseIssue[],
): MLBModelTestReleaseResult | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Combined result must be a plain object');
    return undefined;
  }

  const root = value as Record<string, unknown>;
  validateResultRoot(root, issues);

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  const targetEncodingResult = ownDataProperty(root, 'targetEncoding', '$.targetEncoding', issues);
  const resultIdResult = ownDataProperty(root, 'resultId', '$.resultId', issues);

  if (
    contractVersionResult.kind !== 'data' || contractVersionResult.value !== MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION ||
    sportResult.kind !== 'data' || sportResult.value !== 'MLB' ||
    targetResult.kind !== 'data' || targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER' ||
    targetEncodingResult.kind !== 'data' || targetEncodingResult.value !== 'HOME_WIN_1_AWAY_WIN_0' ||
    resultIdResult.kind !== 'data' || typeof resultIdResult.value !== 'string'
  ) {
    return undefined;
  }

  const fitValidation = ownDataProperty(root, 'fitValidation', '$.fitValidation', issues);
  const test = ownDataProperty(root, 'test', '$.test', issues);
  const release = ownDataProperty(root, 'release', '$.release', issues);

  if (fitValidation.kind === 'accessor' || test.kind === 'accessor' || release.kind === 'accessor') {
    return undefined;
  }

  if (
    (fitValidation.kind === 'data' && !isPlainObject(fitValidation.value)) ||
    (test.kind === 'data' && !isPlainObject(test.value)) ||
    (release.kind === 'data' && !isPlainObject(release.value))
  ) {
    return undefined;
  }

  const fitValidationValue = fitValidation.kind === 'data' ? fitValidation.value : undefined;
  const testValue = test.kind === 'data' ? test.value : undefined;
  const releaseValue = release.kind === 'data' ? release.value : undefined;

  if (fitValidationValue === undefined || testValue === undefined || releaseValue === undefined) {
    return undefined;
  }

  return {
    contractVersion: MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    resultId: resultIdResult.value as string,
    fitValidation: fitValidationValue as MLBModelFitValidationResult,
    test: testValue as MLBModelTestEvaluation,
    release: releaseValue as MLBModelReleaseRecord,
  };
}

function runFirewall(
  value: unknown,
  issues: MLBModelTestReleaseIssue[],
): void {
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
                message: `Prohibited odds contamination at ${firewallPath}`,
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
                message: 'Contains an accessor property',
              },
            );
          }
        }
      } else {
        pushUniquePathCode(
          issues,
          {
            code: 'INVALID_JSON_VALUE',
            path: '$',
            message: 'Firewall traversal failed',
          },
        );
      }
    }
  }
}

export function validateMLBModelTestEvaluation(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelTestEvaluation;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelTestReleaseIssue[];
    }> {
  const issues: MLBModelTestReleaseIssue[] = [];

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
                message: `Prohibited odds contamination at ${firewallPath}`,
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
                message: 'Contains an accessor property',
              },
            );
          }
        }
      } else {
        pushUniquePathCode(
          issues,
          {
            code: 'INVALID_JSON_VALUE',
            path: '$',
            message: 'Firewall traversal failed',
          },
        );
      }
    }
  }

  if (!isPlainObject(value)) {
    const finalIssues = sortIssues(issues);
    return { ok: false, issues: finalIssues };
  }

  const root = value as Record<string, unknown>;
  const evaluated = validateTestEvaluation(root, issues);
  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0 || !evaluated) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBModelTestEvaluation };
}

export function validateMLBModelReleaseRecord(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelReleaseRecord;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelTestReleaseIssue[];
    }> {
  const issues: MLBModelTestReleaseIssue[] = [];

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
                message: `Prohibited odds contamination at ${firewallPath}`,
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
                message: 'Contains an accessor property',
              },
            );
          }
        }
      } else {
        pushUniquePathCode(
          issues,
          {
            code: 'INVALID_JSON_VALUE',
            path: '$',
            message: 'Firewall traversal failed',
          },
        );
      }
    }
  }

  if (!isPlainObject(value)) {
    const finalIssues = sortIssues(issues);
    return { ok: false, issues: finalIssues };
  }

  const root = value as Record<string, unknown>;
  const evaluated = validateReleaseRecord(root, issues);
  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0 || !evaluated) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBModelReleaseRecord };
}

export function validateMLBModelTestReleaseResult(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelTestReleaseResult;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelTestReleaseIssue[];
    }> {
  const issues: MLBModelTestReleaseIssue[] = [];

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
                message: `Prohibited odds contamination at ${firewallPath}`,
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
                message: 'Contains an accessor property',
              },
            );
          }
        }
      } else {
        pushUniquePathCode(
          issues,
          {
            code: 'INVALID_JSON_VALUE',
            path: '$',
            message: 'Firewall traversal failed',
          },
        );
      }
    }
  }

  if (!isPlainObject(value)) {
    const finalIssues = sortIssues(issues);
    return { ok: false, issues: finalIssues };
  }

  const root = value as Record<string, unknown>;
  const evaluated = validateCombinedResult(root, issues);
  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0 || !evaluated) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBModelTestReleaseResult };
}

function collectTestRows(matrix: MLBTrainingMatrix): MLBTrainingMatrixRow[] {
  const testRows: MLBTrainingMatrixRow[] = [];
  for (const row of matrix.rows) {
    if (row.split === 'TEST') {
      testRows.push(row);
    }
  }
  return testRows;
}

function applyModel(
  model: MLBDeterministicLogisticRegressionModel,
  rows: MLBTrainingMatrixRow[],
  issues: MLBModelTestReleaseIssue[],
): { probabilities: number[]; targets: number[] } | null {
  const schema = rows.length > 0
    ? rows[0].vector.values.map((v) => v.featureId)
    : [];
  const featureIds = model.featureIds;
  if (schema.length !== featureIds.length) {
    pushIssue(issues, 'FEATURE_SCHEMA_MISMATCH', '$.trainingMatrix.rows', 'TEST feature schema does not match model featureIds');
    return null;
  }
  for (let i = 0; i < schema.length; i++) {
    if (schema[i] !== featureIds[i]) {
      pushIssue(issues, 'FEATURE_SCHEMA_MISMATCH', '$.trainingMatrix.rows', `TEST featureId ${schema[i]} does not match model featureId ${featureIds[i]}`);
      return null;
    }
  }

  const coefficients = new Map<string, { valueCoefficient: number; missingIndicatorCoefficient: number }>();
  for (const coeff of model.coefficients) {
    coefficients.set(coeff.featureId, {
      valueCoefficient: coeff.valueCoefficient,
      missingIndicatorCoefficient: coeff.missingIndicatorCoefficient,
    });
  }

  const probabilities: number[] = [];
  const targets: number[] = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    let score = model.intercept;
    for (let f = 0; f < featureIds.length; f++) {
      const rawValue = row.vector.values[f].value;
      const wasMissing = row.vector.values[f].wasMissing ? 1 : 0;
      const coeff = coefficients.get(featureIds[f]);
      if (!coeff) {
        pushIssue(issues, 'FEATURE_SCHEMA_MISMATCH', '$.trainingMatrix.rows', `Missing coefficient for featureId ${featureIds[f]}`);
        return null;
      }
      score += coeff.valueCoefficient * rawValue;
      score += coeff.missingIndicatorCoefficient * wasMissing;
    }

    if (!Number.isFinite(score)) {
      pushIssue(issues, 'NUMERICAL_FAILURE', '$.trainingMatrix.rows', `Non-finite score at row ${r}`);
      return null;
    }

    const probability = stableSigmoid(score);
    if (!Number.isFinite(probability)) {
      pushIssue(issues, 'NUMERICAL_FAILURE', '$.trainingMatrix.rows', `Non-finite probability at row ${r}`);
      return null;
    }

    probabilities.push(probability);
    targets.push(row.targetValue);
  }

  return { probabilities, targets };
}

function calculateTestMetrics(
  probabilities: number[],
  targets: number[],
  issues: MLBModelTestReleaseIssue[],
): MLBTestMetricValues | null {
  const n = probabilities.length;
  let logLossSum = 0;
  let brierSum = 0;
  let positiveCount = 0;
  let negativeCount = 0;
  let rocSum = 0;

  for (let i = 0; i < n; i++) {
    const prob = probabilities[i];
    const target = targets[i];

    if (!Number.isFinite(prob)) {
      pushIssue(issues, 'NUMERICAL_FAILURE', '$.test.metrics', `Non-finite probability at row ${i}`);
      return null;
    }

    logLossSum += stableLogLoss(prob, target);
    brierSum += (prob - target) * (prob - target);

    if (target === 1) positiveCount++;
    else if (target === 0) negativeCount++;

    if (!Number.isFinite(logLossSum)) {
      pushIssue(issues, 'NUMERICAL_FAILURE', '$.test.metrics', `Non-finite logLoss sum at row ${i}`);
      return null;
    }
    if (!Number.isFinite(brierSum)) {
      pushIssue(issues, 'NUMERICAL_FAILURE', '$.test.metrics', `Non-finite brier sum at row ${i}`);
      return null;
    }
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
    if (!Number.isFinite(rocSum)) {
      pushIssue(issues, 'NUMERICAL_FAILURE', '$.test.metrics', `Non-finite rocSum at row ${i}`);
      return null;
    }
  }

  const logLoss = logLossSum / n;
  const brierScore = brierSum / n;
  const rocAuc = positiveCount > 0 && negativeCount > 0 ? rocSum / (positiveCount * negativeCount) : 0;

  if (!Number.isFinite(logLoss)) {
    pushIssue(issues, 'NUMERICAL_FAILURE', '$.test.metrics.logLoss', 'Non-finite logLoss');
    return null;
  }
  if (!Number.isFinite(brierScore)) {
    pushIssue(issues, 'NUMERICAL_FAILURE', '$.test.metrics.brierScore', 'Non-finite brierScore');
    return null;
  }
  if (!Number.isFinite(rocAuc)) {
    pushIssue(issues, 'NUMERICAL_FAILURE', '$.test.metrics.rocAuc', 'Non-finite rocAuc');
    return null;
  }

  return {
    logLoss: normalizeNegativeZero(logLoss),
    brierScore: normalizeNegativeZero(brierScore),
    rocAuc: normalizeNegativeZero(rocAuc),
  };
}

function assertConsistency(
  fitValidation: MLBModelFitValidationResult,
  plan: MLBModelEvaluationPlan,
  matrix: MLBTrainingMatrix,
  issues: MLBModelTestReleaseIssue[],
): void {
  if (fitValidation.model.planId !== plan.planId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fitValidationResult.model.planId', 'model planId must equal evaluationPlan.planId');
  }
  if (fitValidation.model.matrixId !== plan.matrixId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fitValidationResult.model.matrixId', 'model matrixId must equal evaluationPlan.matrixId');
  }
  if (fitValidation.model.configId !== plan.configId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fitValidationResult.model.configId', 'model configId must equal evaluationPlan.configId');
  }
  if (fitValidation.model.manifestId !== plan.manifestId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fitValidationResult.model.manifestId', 'model manifestId must equal evaluationPlan.manifestId');
  }
  if (fitValidation.model.datasetId !== plan.datasetId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.fitValidationResult.model.datasetId', 'model datasetId must equal evaluationPlan.datasetId');
  }
  if (fitValidation.model.algorithm !== plan.algorithm) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.algorithm', 'model algorithm must equal evaluationPlan.algorithm');
  }
  if (fitValidation.sport !== plan.sport || fitValidation.target !== plan.target || fitValidation.targetEncoding !== plan.targetEncoding) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$', 'Fit validation and evaluation plan must agree on sport, target, and targetEncoding');
  }

  if (plan.matrixId !== matrix.matrixId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.evaluationPlan.matrixId', 'evaluationPlan.matrixId must equal trainingMatrix.matrixId');
  }
  if (plan.manifestId !== matrix.manifestId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.evaluationPlan.manifestId', 'evaluationPlan.manifestId must equal trainingMatrix.manifestId');
  }
  if (plan.datasetId !== matrix.datasetId) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$.evaluationPlan.datasetId', 'evaluationPlan.datasetId must equal trainingMatrix.datasetId');
  }
  if (plan.sport !== matrix.sport || plan.target !== matrix.target || plan.targetEncoding !== matrix.targetEncoding) {
    pushIssue(issues, 'SOURCE_IDENTITY_MISMATCH', '$', 'Evaluation plan and training matrix must agree on sport, target, and targetEncoding');
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

  if (plan.protocol !== 'TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1') {
    pushIssue(issues, 'HOLDOUT_POLICY_MISMATCH', '$.protocol', 'protocol must be TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1');
  }
  if (plan.testSetPolicy !== 'HOLDOUT_UNTIL_CONFIGURATION_LOCKED') {
    pushIssue(issues, 'HOLDOUT_POLICY_MISMATCH', '$.testSetPolicy', 'testSetPolicy must be HOLDOUT_UNTIL_CONFIGURATION_LOCKED');
  }
}

export function evaluateAndReleaseMLBDeterministicModel(
  fitValidationResult: unknown,
  evaluationPlan: unknown,
  trainingMatrix: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelTestReleaseResult;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelTestReleaseIssue[];
    }> {
  const issues: MLBModelTestReleaseIssue[] = [];

  const fitValidationResultValidated = validateMLBModelFitValidationResult(fitValidationResult);
  if (!fitValidationResultValidated.ok) {
    return {
      ok: false,
      issues: sortIssues([
        {
          code: 'FIT_VALIDATION_RESULT_INVALID',
          path: '$.fitValidationResult',
          message: `Fit validation result invalid: ${fitValidationResultValidated.issues[0]?.code ?? 'unknown'} at ${fitValidationResultValidated.issues[0]?.path ?? '$'}`,
        },
      ]),
    };
  }

  const planValidated = validateMLBModelEvaluationPlan(evaluationPlan);
  if (!planValidated.ok) {
    return {
      ok: false,
      issues: sortIssues([
        {
          code: 'PLAN_INVALID',
          path: '$.evaluationPlan',
          message: `Evaluation plan invalid: ${planValidated.issues[0]?.code ?? 'unknown'} at ${planValidated.issues[0]?.path ?? '$'}`,
        },
      ]),
    };
  }

  const matrixValidated = validateMLBTrainingMatrix(trainingMatrix);
  if (!matrixValidated.ok) {
    return {
      ok: false,
      issues: sortIssues([
        {
          code: 'MATRIX_INVALID',
          path: '$.trainingMatrix',
          message: `Training matrix invalid: ${matrixValidated.issues[0]?.code ?? 'unknown'} at ${matrixValidated.issues[0]?.path ?? '$'}`,
        },
      ]),
    };
  }

  const fitValidation = fitValidationResultValidated.value;
  const plan = planValidated.value;
  const matrix = matrixValidated.value;

  assertConsistency(fitValidation, plan, matrix, issues);
  if (issues.length > 0) {
    const finalIssues = sortIssues(issues);
    return { ok: false, issues: finalIssues };
  }

  const testRows = collectTestRows(matrix);
  if (testRows.length === 0) {
    return {
      ok: false,
      issues: sortIssues([
        { code: 'INSUFFICIENT_TEST_CLASS_VARIATION', path: '$.trainingMatrix.rows', message: 'TEST split must contain at least one row' },
      ]),
    };
  }

  const schema = testRows[0].vector.values.map((v) => v.featureId);
  if (schema.length !== fitValidation.model.featureIds.length) {
    return {
      ok: false,
      issues: sortIssues([
        { code: 'FEATURE_SCHEMA_MISMATCH', path: '$.trainingMatrix.rows', message: 'TEST feature schema length does not match model featureIds length' },
      ]),
    };
  }
  for (let i = 0; i < schema.length; i++) {
    if (schema[i] !== fitValidation.model.featureIds[i]) {
      return {
        ok: false,
        issues: sortIssues([
          { code: 'FEATURE_SCHEMA_MISMATCH', path: '$.trainingMatrix.rows', message: `TEST featureId ${schema[i]} does not match model featureId ${fitValidation.model.featureIds[i]}` },
        ]),
      };
    }
  }

  let hasPositive = false;
  let hasNegative = false;
  for (const row of testRows) {
    if (row.targetValue === 1) hasPositive = true;
    else if (row.targetValue === 0) hasNegative = true;
    if (hasPositive && hasNegative) break;
  }
  if (!hasPositive || !hasNegative) {
    return {
      ok: false,
      issues: sortIssues([
        { code: 'INSUFFICIENT_TEST_CLASS_VARIATION', path: '$.trainingMatrix.rows', message: 'TEST split must contain at least one target 0 and one target 1' },
      ]),
    };
  }

  const applied = applyModel(fitValidation.model, testRows, issues);
  if (!applied) {
    const finalIssues = sortIssues(issues);
    return { ok: false, issues: finalIssues };
  }

  const metrics = calculateTestMetrics(applied.probabilities, applied.targets, issues);
  if (!metrics) {
    const finalIssues = sortIssues(issues);
    return { ok: false, issues: finalIssues };
  }

  const modelId = fitValidation.model.modelId;
  const testEvaluation: MLBModelTestEvaluation = {
    contractVersion: MLB_TEST_EVALUATION_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: `${modelId}::test-v1`,
    modelId,
    planId: fitValidation.model.planId,
    matrixId: fitValidation.model.matrixId,
    configId: fitValidation.model.configId,
    split: 'TEST',
    rowCount: testRows.length,
    metrics,
  };

  const releaseRecord: MLBModelReleaseRecord = {
    contractVersion: MLB_MODEL_RELEASE_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    releaseId: `${modelId}::offline-release-candidate-v1`,
    modelId,
    planId: fitValidation.model.planId,
    matrixId: fitValidation.model.matrixId,
    configId: fitValidation.model.configId,
    manifestId: fitValidation.model.manifestId,
    datasetId: fitValidation.model.datasetId,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    validationEvaluationId: fitValidation.validation.evaluationId,
    testEvaluationId: testEvaluation.evaluationId,
    configurationLockStatus: 'LOCKED_BEFORE_TEST_EVALUATION',
    testEvaluationPolicy: 'HELD_OUT_TEST_FINAL_EVALUATION_V1',
    releaseStatus: 'OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED',
  };

  const resultId = `${fitValidation.model.planId}::test-release-v1`;
  const combinedResult: MLBModelTestReleaseResult = {
    contractVersion: MLB_TEST_RELEASE_RESULT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    resultId,
    fitValidation,
    test: testEvaluation,
    release: releaseRecord,
  };

  const validationResult = validateMLBModelTestReleaseResult(combinedResult);
  if (!validationResult.ok) {
    return {
      ok: false,
      issues: sortIssues([
        {
          code: 'GENERATED_RESULT_INVALID',
          path: '$',
          message: `Generated result invalid: ${validationResult.issues[0]?.code ?? 'unknown'} at ${validationResult.issues[0]?.path ?? '$'}`,
        },
      ]),
    };
  }

  const finalIssues: MLBModelTestReleaseIssue[] = [];
  runFirewall(combinedResult, finalIssues);
  if (finalIssues.length > 0) {
    return {
      ok: false,
      issues: sortIssues(finalIssues),
    };
  }

  return { ok: true, value: validationResult.value };
}
