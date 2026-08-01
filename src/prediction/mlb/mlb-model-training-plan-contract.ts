import {
  assertNoOddsContamination,
} from '../firewall/odds-contamination-guard';
import {
  validateMLBTrainingMatrix,
  type MLBTrainingMatrix,
  type MLBTrainingMatrixRow,
} from './mlb-training-matrix-contract';

export const MLB_MODEL_TRAINING_CONFIGURATION_CONTRACT_VERSION =
  'mlb-model-training-configuration-v1' as const;

export const MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION =
  'mlb-model-evaluation-plan-v1' as const;

export type MLBModelAlgorithm = 'L2_LOGISTIC_REGRESSION_BINARY_V1';

export type MLBModelRandomnessPolicy = 'NO_RANDOMNESS';

export type MLBModelFeatureValuePolicy = 'RAW_FINITE_FEATURE_VALUES';

export type MLBModelMissingIndicatorPolicy = 'PRESERVE_WAS_MISSING_FLAGS';

export type MLBModelRegularization = Readonly<{
  kind: 'L2';
  strength: number;
}>;

export type MLBModelOptimization = Readonly<{
  solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1';
  learningRate: number;
  maxIterations: number;
  tolerance: number;
}>;

export type MLBModelTrainingConfiguration = Readonly<{
  contractVersion: typeof MLB_MODEL_TRAINING_CONFIGURATION_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  configId: string;
  algorithm: MLBModelAlgorithm;
  randomnessPolicy: MLBModelRandomnessPolicy;
  featureValuePolicy: MLBModelFeatureValuePolicy;
  missingIndicatorPolicy: MLBModelMissingIndicatorPolicy;
  regularization: MLBModelRegularization;
  optimization: MLBModelOptimization;
}>;

export type MLBModelEvaluationMetric = 'LOG_LOSS' | 'BRIER_SCORE' | 'ROC_AUC';

export type MLBModelEvaluationPlan = Readonly<{
  contractVersion: typeof MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  planId: string;
  matrixId: string;
  configId: string;
  manifestId: string;
  datasetId: string;
  algorithm: MLBModelAlgorithm;
  featureIds: readonly string[];
  splitPolicy: {
    strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1';
    embargoDays: number;
    train: { startDate: string; endDate: string };
    validation: { startDate: string; endDate: string };
    test: { startDate: string; endDate: string };
  };
  splitCounts: {
    train: number;
    validation: number;
    test: number;
  };
  totalRows: number;
  protocol: 'TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1';
  selectionMetric: 'LOG_LOSS';
  reportedMetrics: readonly MLBModelEvaluationMetric[];
  testSetPolicy: 'HOLDOUT_UNTIL_CONFIGURATION_LOCKED';
}>;

export type MLBModelTrainingPlanIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_DATE'
    | 'INVALID_ARRAY'
    | 'DUPLICATE_ID'
    | 'NON_CANONICAL_ORDER'
    | 'CONFIGURATION_INVALID'
    | 'MATRIX_INVALID'
    | 'INSUFFICIENT_SPLIT_ROWS'
    | 'PLAN_ID_MISMATCH'
    | 'FEATURE_SCHEMA_MISMATCH'
    | 'SPLIT_POLICY_VIOLATION'
    | 'SPLIT_COUNT_MISMATCH'
    | 'METRIC_CONFIGURATION_MISMATCH'
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
  issues: MLBModelTrainingPlanIssue[],
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
  issues: MLBModelTrainingPlanIssue[],
  code: MLBModelTrainingPlanIssue['code'],
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
  issues: MLBModelTrainingPlanIssue[],
  next: MLBModelTrainingPlanIssue,
): void {
  const exists = issues.some(
    (item) => item.path === next.path && item.code === next.code,
  );
  if (!exists) {
    issues.push(next);
  }
}

function sortIssues(
  issues: MLBModelTrainingPlanIssue[],
): MLBModelTrainingPlanIssue[] {
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
  issues: MLBModelTrainingPlanIssue[],
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

function readDescriptorSafeArray(
  value: unknown,
  path: string,
  issues: MLBModelTrainingPlanIssue[],
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

function validateGregorianDate(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = leap ? 29 : daysInMonth[month - 1];
  return day <= maxDay;
}

function dateFrom(iso: string): Date {
  return new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
}

function calendarDaysBetween(start: Date, end: Date): number {
  const a = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const b = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const diff = Math.floor((b.getTime() - a.getTime()) / 86400000) - 1;
  return Math.max(0, diff);
}

type SplitPolicyWindow = Readonly<{
  startDate: string;
  endDate: string;
}>;

type PlanSplitPolicy = {
  strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1';
  embargoDays: number;
  train: SplitPolicyWindow;
  validation: SplitPolicyWindow;
  test: SplitPolicyWindow;
};

function copySplitPolicy(
  policy: PlanSplitPolicy,
): PlanSplitPolicy {
  return {
    strategy: policy.strategy,
    embargoDays: policy.embargoDays,
    train: { ...policy.train },
    validation: { ...policy.validation },
    test: { ...policy.test },
  };
}

const PROHIBITED_PLAN_FIELDS = new Set([
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
  'prediction',
  'probability',
  'coefficient',
  'coefficients',
  'intercept',
  'modelArtifact',
  'metricResults',
  'recommendation',
  'stake',
  'grading',
]);

const KNOWN_CONFIGURATION_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'configId',
  'algorithm',
  'randomnessPolicy',
  'featureValuePolicy',
  'missingIndicatorPolicy',
  'regularization',
  'optimization',
]);

const KNOWN_REGULARIZATION_FIELDS = new Set(['kind', 'strength']);

const KNOWN_OPTIMIZATION_FIELDS = new Set([
  'solver',
  'learningRate',
  'maxIterations',
  'tolerance',
]);

const KNOWN_PLAN_ROOT_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'planId',
  'matrixId',
  'configId',
  'manifestId',
  'datasetId',
  'algorithm',
  'featureIds',
  'splitPolicy',
  'splitCounts',
  'totalRows',
  'protocol',
  'selectionMetric',
  'reportedMetrics',
  'testSetPolicy',
]);

const KNOWN_SPLIT_POLICY_FIELDS = new Set([
  'strategy',
  'embargoDays',
  'train',
  'validation',
  'test',
]);

const KNOWN_SPLIT_WINDOW_FIELDS = new Set(['startDate', 'endDate']);

const KNOWN_SPLIT_COUNTS_FIELDS = new Set(['train', 'validation', 'test']);

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
): string | MLBModelTrainingPlanIssue {
  if (!isStrictNonEmptyTrimmedString(value)) {
    return { code: 'INVALID_STRING', path, message: `${label} must be a valid identifier` };
  }
  return value;
}

function validateRegularization(
  value: unknown,
  path: string,
  issues: MLBModelTrainingPlanIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'regularization must be a plain object');
    return;
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, KNOWN_REGULARIZATION_FIELDS, path, issues);

  const kindResult = ownDataProperty(root, 'kind', `${path}.kind`, issues);
  if (kindResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.kind`, 'kind is required');
  } else if (kindResult.kind === 'data') {
    if (kindResult.value !== 'L2') {
      pushIssue(issues, 'INVALID_LITERAL', `${path}.kind`, 'kind must be L2');
    }
  }

  const strengthResult = ownDataProperty(root, 'strength', `${path}.strength`, issues);
  if (strengthResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.strength`, 'strength is required');
  } else if (strengthResult.kind === 'data') {
    if (
      typeof strengthResult.value !== 'number' ||
      !Number.isFinite(strengthResult.value) ||
      strengthResult.value <= 0 ||
      1 / strengthResult.value === -Infinity
    ) {
      pushIssue(issues, 'INVALID_NUMBER', `${path}.strength`, 'strength must be a finite number strictly greater than zero');
    }
  }
}

function validateOptimization(
  value: unknown,
  path: string,
  issues: MLBModelTrainingPlanIssue[],
): void {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'optimization must be a plain object');
    return;
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, KNOWN_OPTIMIZATION_FIELDS, path, issues);

  const solverResult = ownDataProperty(root, 'solver', `${path}.solver`, issues);
  if (solverResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.solver`, 'solver is required');
  } else if (solverResult.kind === 'data') {
    if (solverResult.value !== 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1') {
      pushIssue(issues, 'INVALID_LITERAL', `${path}.solver`, 'solver must be DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1');
    }
  }

  const learningRateResult = ownDataProperty(root, 'learningRate', `${path}.learningRate`, issues);
  if (learningRateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.learningRate`, 'learningRate is required');
  } else if (learningRateResult.kind === 'data') {
    if (
      typeof learningRateResult.value !== 'number' ||
      !Number.isFinite(learningRateResult.value) ||
      learningRateResult.value <= 0 ||
      learningRateResult.value > 1 ||
      1 / learningRateResult.value === -Infinity
    ) {
      pushIssue(
        issues,
        'INVALID_NUMBER',
        `${path}.learningRate`,
        'learningRate must be a finite number strictly greater than zero and at most 1',
      );
    }
  }

  const maxIterationsResult = ownDataProperty(root, 'maxIterations', `${path}.maxIterations`, issues);
  if (maxIterationsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.maxIterations`, 'maxIterations is required');
  } else if (maxIterationsResult.kind === 'data') {
    if (
      typeof maxIterationsResult.value !== 'number' ||
      !Number.isSafeInteger(maxIterationsResult.value) ||
      maxIterationsResult.value <= 0 ||
      maxIterationsResult.value > 1_000_000
    ) {
      pushIssue(
        issues,
        'INVALID_INTEGER',
        `${path}.maxIterations`,
        'maxIterations must be a positive safe integer at most 1000000',
      );
    }
  }

  const toleranceResult = ownDataProperty(root, 'tolerance', `${path}.tolerance`, issues);
  if (toleranceResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.tolerance`, 'tolerance is required');
  } else if (toleranceResult.kind === 'data') {
    if (
      typeof toleranceResult.value !== 'number' ||
      !Number.isFinite(toleranceResult.value) ||
      toleranceResult.value <= 0 ||
      toleranceResult.value >= 1 ||
      1 / toleranceResult.value === -Infinity
    ) {
      pushIssue(
        issues,
        'INVALID_NUMBER',
        `${path}.tolerance`,
        'tolerance must be a finite number strictly greater than zero and less than 1',
      );
    }
  }
}

function validateConfigurationRoot(
  value: Record<string, unknown>,
  issues: MLBModelTrainingPlanIssue[],
): void {
  addKnownFieldIssues(value, KNOWN_CONFIGURATION_FIELDS, '$', issues);

  const contractVersionResult = ownDataProperty(value, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_MODEL_TRAINING_CONFIGURATION_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_MODEL_TRAINING_CONFIGURATION_CONTRACT_VERSION}`,
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

  const configIdResult = ownDataProperty(value, 'configId', '$.configId', issues);
  if (configIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.configId', 'configId is required');
  } else if (configIdResult.kind === 'data') {
    const id = validateIdentifier(configIdResult.value, '$.configId', 'configId');
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

  const randomnessPolicyResult = ownDataProperty(value, 'randomnessPolicy', '$.randomnessPolicy', issues);
  if (randomnessPolicyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.randomnessPolicy', 'randomnessPolicy is required');
  } else if (randomnessPolicyResult.kind === 'data') {
    if (randomnessPolicyResult.value !== 'NO_RANDOMNESS') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.randomnessPolicy',
        'randomnessPolicy must be NO_RANDOMNESS',
      );
    }
  }

  const featureValuePolicyResult = ownDataProperty(value, 'featureValuePolicy', '$.featureValuePolicy', issues);
  if (featureValuePolicyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.featureValuePolicy', 'featureValuePolicy is required');
  } else if (featureValuePolicyResult.kind === 'data') {
    if (featureValuePolicyResult.value !== 'RAW_FINITE_FEATURE_VALUES') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.featureValuePolicy',
        'featureValuePolicy must be RAW_FINITE_FEATURE_VALUES',
      );
    }
  }

  const missingIndicatorPolicyResult = ownDataProperty(value, 'missingIndicatorPolicy', '$.missingIndicatorPolicy', issues);
  if (missingIndicatorPolicyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.missingIndicatorPolicy', 'missingIndicatorPolicy is required');
  } else if (missingIndicatorPolicyResult.kind === 'data') {
    if (missingIndicatorPolicyResult.value !== 'PRESERVE_WAS_MISSING_FLAGS') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.missingIndicatorPolicy',
        'missingIndicatorPolicy must be PRESERVE_WAS_MISSING_FLAGS',
      );
    }
  }

  const regularizationResult = ownDataProperty(value, 'regularization', '$.regularization', issues);
  if (regularizationResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.regularization', 'regularization is required');
  } else if (regularizationResult.kind === 'data') {
    validateRegularization(regularizationResult.value, '$.regularization', issues);
  }

  const optimizationResult = ownDataProperty(value, 'optimization', '$.optimization', issues);
  if (optimizationResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.optimization', 'optimization is required');
  } else if (optimizationResult.kind === 'data') {
    validateOptimization(optimizationResult.value, '$.optimization', issues);
  }
}

export function validateMLBModelTrainingConfiguration(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelTrainingConfiguration;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelTrainingPlanIssue[];
    }> {
  const issues: MLBModelTrainingPlanIssue[] = [];

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
                message: `Configuration contains prohibited field at ${firewallPath}`,
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
                message: 'Configuration contains an accessor property',
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

  for (const key of Object.getOwnPropertyNames(root)) {
    if (PROHIBITED_PLAN_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'PROHIBITED_CONCEPT', `$.${key}`, `Prohibited field: ${key}`);
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, `Prohibited accessor: ${key}`);
      }
    }
  }

  const symbols = Object.getOwnPropertySymbols(root);
  for (const symbol of symbols) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }

  validateConfigurationRoot(root, issues);

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBModelTrainingConfiguration };
}

function validateSplitWindow(
  parent: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBModelTrainingPlanIssue[],
): { startDate: string; endDate: string } | undefined {
  const result = ownDataProperty(parent, key, path, issues);
  if (result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return undefined;
  }
  if (result.kind === 'accessor') {
    return undefined;
  }
  const window = result.value;
  if (!isPlainObject(window)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, `${path} must be a plain object`);
    return undefined;
  }
  const windowRoot = window as Record<string, unknown>;
  addKnownFieldIssues(windowRoot, KNOWN_SPLIT_WINDOW_FIELDS, path, issues);

  const startDateResult = ownDataProperty(windowRoot, 'startDate', `${path}.startDate`, issues);
  if (startDateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.startDate`, 'startDate is required');
    return undefined;
  }
  const endDateResult = ownDataProperty(windowRoot, 'endDate', `${path}.endDate`, issues);
  if (endDateResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.endDate`, 'endDate is required');
    return undefined;
  }
  if (startDateResult.kind === 'accessor' || endDateResult.kind === 'accessor') {
    return undefined;
  }
  const startDate = startDateResult.value as string;
  const endDate = endDateResult.value as string;
  if (!validateGregorianDate(startDate) || !validateGregorianDate(endDate)) {
    pushIssue(issues, 'INVALID_DATE', path, `${path} must use valid Gregorian dates`);
    return undefined;
  }
  const startDateObj = dateFrom(startDate);
  const endDateObj = dateFrom(endDate);
  if (startDateObj > endDateObj) {
    pushIssue(issues, 'SPLIT_POLICY_VIOLATION', `${path}.startDate`, `${path}.startDate must be <= endDate`);
    return undefined;
  }
  return { startDate, endDate };
}

function validatePlanSplitPolicy(
  value: unknown,
  issues: MLBModelTrainingPlanIssue[],
): PlanSplitPolicy | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.splitPolicy', 'splitPolicy must be a plain object');
    return undefined;
  }
  const policyRoot = value as Record<string, unknown>;

  addKnownFieldIssues(policyRoot, KNOWN_SPLIT_POLICY_FIELDS, '$.splitPolicy', issues);

  const strategyResult = ownDataProperty(policyRoot, 'strategy', '$.splitPolicy.strategy', issues);
  if (strategyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.splitPolicy.strategy', 'strategy is required');
  } else if (strategyResult.kind === 'data') {
    if (strategyResult.value !== 'CHRONOLOGICAL_OFFICIAL_DATE_V1') {
      pushIssue(issues, 'INVALID_LITERAL', '$.splitPolicy.strategy', 'strategy must be CHRONOLOGICAL_OFFICIAL_DATE_V1');
    }
  }

  const embargoDaysResult = ownDataProperty(policyRoot, 'embargoDays', '$.splitPolicy.embargoDays', issues);
  let embargoDays: number | undefined;
  if (embargoDaysResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.splitPolicy.embargoDays', 'embargoDays is required');
  } else if (embargoDaysResult.kind === 'data') {
    if (
      typeof embargoDaysResult.value !== 'number' ||
      !Number.isSafeInteger(embargoDaysResult.value) ||
      embargoDaysResult.value < 0
    ) {
      pushIssue(issues, 'INVALID_INTEGER', '$.splitPolicy.embargoDays', 'embargoDays must be a non-negative safe integer');
    } else {
      embargoDays = embargoDaysResult.value;
    }
  }

  const train = validateSplitWindow(policyRoot, 'train', '$.splitPolicy.train', issues);
  const validation = validateSplitWindow(policyRoot, 'validation', '$.splitPolicy.validation', issues);
  const test = validateSplitWindow(policyRoot, 'test', '$.splitPolicy.test', issues);

  if (train && validation && test && embargoDays !== undefined) {
    const trainEnd = dateFrom(train.endDate);
    const validationStart = dateFrom(validation.startDate);
    const validationEnd = dateFrom(validation.endDate);
    const testStart = dateFrom(test.startDate);

    if (trainEnd >= validationStart) {
      pushIssue(issues, 'SPLIT_POLICY_VIOLATION', '$.splitPolicy', 'Train must end before validation starts');
    }
    if (validationEnd >= testStart) {
      pushIssue(issues, 'SPLIT_POLICY_VIOLATION', '$.splitPolicy', 'Validation must end before test starts');
    }

    const embargo1 = calendarDaysBetween(trainEnd, validationStart);
    if (embargo1 < embargoDays) {
      pushIssue(
        issues,
        'SPLIT_POLICY_VIOLATION',
        '$.splitPolicy',
        `Embargo between train and validation must be at least ${embargoDays} days`,
      );
    }

    const embargo2 = calendarDaysBetween(validationEnd, testStart);
    if (embargo2 < embargoDays) {
      pushIssue(
        issues,
        'SPLIT_POLICY_VIOLATION',
        '$.splitPolicy',
        `Embargo between validation and test must be at least ${embargoDays} days`,
      );
    }
  }

  if (
    !train ||
    !validation ||
    !test ||
    embargoDays === undefined
  ) {
    return undefined;
  }

  return {
    strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
    embargoDays,
    train,
    validation,
    test,
  };
}

function validateFeatureIds(
  value: unknown,
  path: string,
  issues: MLBModelTrainingPlanIssue[],
): string[] | undefined {
  const arrayResult = readDescriptorSafeArray(value, path, issues);
  if (arrayResult === null) {
    return undefined;
  }

  if (arrayResult.length === 0) {
    pushIssue(issues, 'INVALID_ARRAY', path, 'featureIds must not be empty');
    return undefined;
  }

  const validIds: string[] = [];
  for (let i = 0; i < arrayResult.length; i++) {
    const element = arrayResult[i];
    const elementPath = `${path}[${i}]`;
    if (typeof element !== 'string') {
      pushIssue(issues, 'INVALID_STRING', elementPath, 'featureId must be a string');
      continue;
    }
    if (!isStrictNonEmptyTrimmedString(element)) {
      pushIssue(issues, 'INVALID_STRING', elementPath, 'featureId must be a valid identifier');
      continue;
    }
    validIds.push(element);
  }

  const seen = new Set<string>();
  for (const id of validIds) {
    if (seen.has(id)) {
      pushIssue(issues, 'DUPLICATE_ID', path, `Duplicate featureId: ${id}`);
      break;
    }
    seen.add(id);
  }

  for (let i = 1; i < validIds.length; i++) {
    if (validIds[i - 1] >= validIds[i]) {
      pushIssue(issues, 'NON_CANONICAL_ORDER', path, 'featureIds must be in canonical order');
      break;
    }
  }

  return validIds;
}

function validateSplitCounts(
  value: unknown,
  path: string,
  issues: MLBModelTrainingPlanIssue[],
): { train: number; validation: number; test: number } | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'splitCounts must be a plain object');
    return undefined;
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, KNOWN_SPLIT_COUNTS_FIELDS, path, issues);

  const trainResult = ownDataProperty(root, 'train', `${path}.train`, issues);
  let train: number | undefined;
  if (trainResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.train`, 'train is required');
  } else if (trainResult.kind === 'data') {
    if (typeof trainResult.value !== 'number' || !Number.isSafeInteger(trainResult.value) || trainResult.value <= 0) {
      pushIssue(issues, 'INVALID_INTEGER', `${path}.train`, 'train must be a positive safe integer');
    } else {
      train = trainResult.value;
    }
  }

  const validationResult = ownDataProperty(root, 'validation', `${path}.validation`, issues);
  let validation: number | undefined;
  if (validationResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.validation`, 'validation is required');
  } else if (validationResult.kind === 'data') {
    if (typeof validationResult.value !== 'number' || !Number.isSafeInteger(validationResult.value) || validationResult.value <= 0) {
      pushIssue(issues, 'INVALID_INTEGER', `${path}.validation`, 'validation must be a positive safe integer');
    } else {
      validation = validationResult.value;
    }
  }

  const testResult = ownDataProperty(root, 'test', `${path}.test`, issues);
  let test: number | undefined;
  if (testResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.test`, 'test is required');
  } else if (testResult.kind === 'data') {
    if (typeof testResult.value !== 'number' || !Number.isSafeInteger(testResult.value) || testResult.value <= 0) {
      pushIssue(issues, 'INVALID_INTEGER', `${path}.test`, 'test must be a positive safe integer');
    } else {
      test = testResult.value;
    }
  }

  if (train !== undefined && validation !== undefined && test !== undefined) {
    return { train, validation, test };
  }

  return undefined;
}

function validateEvaluationPlanRoot(
  value: Record<string, unknown>,
  issues: MLBModelTrainingPlanIssue[],
): void {
  addKnownFieldIssues(value, KNOWN_PLAN_ROOT_FIELDS, '$', issues);

  for (const key of Object.getOwnPropertyNames(value)) {
    if (PROHIBITED_PLAN_FIELDS.has(key)) {
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
    if (contractVersionResult.value !== MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION}`,
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

  const matrixIdResult = ownDataProperty(value, 'matrixId', '$.matrixId', issues);
  let matrixId: string | undefined;
  if (matrixIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.matrixId', 'matrixId is required');
  } else if (matrixIdResult.kind === 'data') {
    const id = validateIdentifier(matrixIdResult.value, '$.matrixId', 'matrixId');
    if (typeof id === 'string') {
      matrixId = id;
    } else {
      issues.push(id);
    }
  }

  const configIdResult = ownDataProperty(value, 'configId', '$.configId', issues);
  let configId: string | undefined;
  if (configIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.configId', 'configId is required');
  } else if (configIdResult.kind === 'data') {
    const id = validateIdentifier(configIdResult.value, '$.configId', 'configId');
    if (typeof id === 'string') {
      configId = id;
    } else {
      issues.push(id);
    }
  }

  const planIdResult = ownDataProperty(value, 'planId', '$.planId', issues);
  if (planIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.planId', 'planId is required');
  } else if (planIdResult.kind === 'data') {
    if (matrixId !== undefined && configId !== undefined) {
      const expectedPlanId = `${matrixId}::${configId}`;
      if (planIdResult.value !== expectedPlanId) {
        pushIssue(
          issues,
          'PLAN_ID_MISMATCH',
          '$.planId',
          `planId must equal ${expectedPlanId}`,
        );
      }
    }
  }

  const manifestIdResult = ownDataProperty(value, 'manifestId', '$.manifestId', issues);
  if (manifestIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.manifestId', 'manifestId is required');
  } else {
    const id = validateIdentifier(
      manifestIdResult.kind === 'data' ? manifestIdResult.value : '',
      '$.manifestId',
      'manifestId',
    );
    if (typeof id !== 'string') {
      if (manifestIdResult.kind === 'data') issues.push(id);
    }
  }

  const datasetIdResult = ownDataProperty(value, 'datasetId', '$.datasetId', issues);
  if (datasetIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetId', 'datasetId is required');
  } else {
    const id = validateIdentifier(
      datasetIdResult.kind === 'data' ? datasetIdResult.value : '',
      '$.datasetId',
      'datasetId',
    );
    if (typeof id !== 'string') {
      if (datasetIdResult.kind === 'data') issues.push(id);
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
    validateFeatureIds(featureIdsResult.value, '$.featureIds', issues);
  }

  const splitPolicyResult = ownDataProperty(value, 'splitPolicy', '$.splitPolicy', issues);
  if (splitPolicyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.splitPolicy', 'splitPolicy is required');
  } else if (splitPolicyResult.kind === 'data') {
    validatePlanSplitPolicy(splitPolicyResult.value, issues);
  }

  const splitCountsResult = ownDataProperty(value, 'splitCounts', '$.splitCounts', issues);
  if (splitCountsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.splitCounts', 'splitCounts is required');
  } else if (splitCountsResult.kind === 'data') {
    const counts = validateSplitCounts(splitCountsResult.value, '$.splitCounts', issues);
    if (counts) {
      const totalRowsResult = ownDataProperty(value, 'totalRows', '$.totalRows', issues);
      if (totalRowsResult.kind === 'missing') {
        pushIssue(issues, 'MISSING_FIELD', '$.totalRows', 'totalRows is required');
      } else if (totalRowsResult.kind === 'data') {
        if (
          typeof totalRowsResult.value !== 'number' ||
          !Number.isSafeInteger(totalRowsResult.value) ||
          totalRowsResult.value <= 0
        ) {
          pushIssue(issues, 'INVALID_INTEGER', '$.totalRows', 'totalRows must be a positive safe integer');
        } else if (totalRowsResult.value !== counts.train + counts.validation + counts.test) {
          pushIssue(
            issues,
            'SPLIT_COUNT_MISMATCH',
            '$.totalRows',
            `totalRows must equal ${counts.train + counts.validation + counts.test}`,
          );
        }
      }
    }
  }

  const totalRowsResult = ownDataProperty(value, 'totalRows', '$.totalRows', issues);
  if (totalRowsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.totalRows', 'totalRows is required');
  }

  const protocolResult = ownDataProperty(value, 'protocol', '$.protocol', issues);
  if (protocolResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.protocol', 'protocol is required');
  } else if (protocolResult.kind === 'data') {
    if (protocolResult.value !== 'TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.protocol',
        'protocol must be TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1',
      );
    }
  }

  const selectionMetricResult = ownDataProperty(value, 'selectionMetric', '$.selectionMetric', issues);
  if (selectionMetricResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.selectionMetric', 'selectionMetric is required');
  } else if (selectionMetricResult.kind === 'data') {
    if (selectionMetricResult.value !== 'LOG_LOSS') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.selectionMetric',
        'selectionMetric must be LOG_LOSS',
      );
    }
  }

  const reportedMetricsResult = ownDataProperty(value, 'reportedMetrics', '$.reportedMetrics', issues);
  if (reportedMetricsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.reportedMetrics', 'reportedMetrics is required');
  } else if (reportedMetricsResult.kind === 'data') {
    const arrayResult = readDescriptorSafeArray(reportedMetricsResult.value, '$.reportedMetrics', issues);
    if (arrayResult !== null) {
      if (arrayResult.length !== 3) {
        pushIssue(issues, 'INVALID_ARRAY', '$.reportedMetrics', 'reportedMetrics must contain exactly three metrics');
      } else {
        const expected = ['LOG_LOSS', 'BRIER_SCORE', 'ROC_AUC'];
        for (let i = 0; i < 3; i++) {
          if (arrayResult[i] !== expected[i]) {
            pushIssue(
              issues,
              'METRIC_CONFIGURATION_MISMATCH',
              `$.reportedMetrics[${i}]`,
              `reportedMetrics[${i}] must be ${expected[i]}`,
            );
          }
        }
      }
    }
  }

  const testSetPolicyResult = ownDataProperty(value, 'testSetPolicy', '$.testSetPolicy', issues);
  if (testSetPolicyResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.testSetPolicy', 'testSetPolicy is required');
  } else if (testSetPolicyResult.kind === 'data') {
    if (testSetPolicyResult.value !== 'HOLDOUT_UNTIL_CONFIGURATION_LOCKED') {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.testSetPolicy',
        'testSetPolicy must be HOLDOUT_UNTIL_CONFIGURATION_LOCKED',
      );
    }
  }
}

export function validateMLBModelEvaluationPlan(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelEvaluationPlan;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelTrainingPlanIssue[];
    }> {
  const issues: MLBModelTrainingPlanIssue[] = [];

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
                message: `Plan contains prohibited field at ${firewallPath}`,
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
                message: 'Plan contains an accessor property',
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

  validateEvaluationPlanRoot(root, issues);

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBModelEvaluationPlan };
}

export function buildMLBDeterministicModelEvaluationPlan(
  configuration: unknown,
  trainingMatrix: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBModelEvaluationPlan;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBModelTrainingPlanIssue[];
    }> {
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

  const matrixResult = validateMLBTrainingMatrix(trainingMatrix);
  if (!matrixResult.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'MATRIX_INVALID',
          path: '$.trainingMatrix',
          message: `Matrix invalid: ${matrixResult.issues[0]?.code ?? 'unknown'} at ${matrixResult.issues[0]?.path ?? '$'}`,
        },
      ],
    };
  }

  const validatedConfig = configResult.value;
  const validatedMatrix = matrixResult.value;

  const { train, validation, test } = validatedMatrix.splitCounts;
  if (train <= 0 || validation <= 0 || test <= 0) {
    return {
      ok: false,
      issues: [
        {
          code: 'INSUFFICIENT_SPLIT_ROWS',
          path: '$.trainingMatrix.splitCounts',
          message: 'Every split must contain at least one row',
        },
      ],
    };
  }

  const firstRow = validatedMatrix.rows[0];
  const featureIds = firstRow.vector.values.map((v) => v.featureId);

  const plan: MLBModelEvaluationPlan = {
    contractVersion: MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    planId: `${validatedMatrix.matrixId}::${validatedConfig.configId}`,
    matrixId: validatedMatrix.matrixId,
    configId: validatedConfig.configId,
    manifestId: validatedMatrix.manifestId,
    datasetId: validatedMatrix.datasetId,
    algorithm: validatedConfig.algorithm,
    featureIds,
    splitPolicy: copySplitPolicy(validatedMatrix.splitPolicy),
    splitCounts: { ...validatedMatrix.splitCounts },
    totalRows: validatedMatrix.rows.length,
    protocol: 'TRAIN_FIT_VALIDATION_SELECT_TEST_FINAL_V1',
    selectionMetric: 'LOG_LOSS',
    reportedMetrics: ['LOG_LOSS', 'BRIER_SCORE', 'ROC_AUC'],
    testSetPolicy: 'HOLDOUT_UNTIL_CONFIGURATION_LOCKED',
  };

  const planResult = validateMLBModelEvaluationPlan(plan);
  if (!planResult.ok) {
    return { ok: false, issues: planResult.issues };
  }

  try {
    assertNoOddsContamination(plan);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        return {
          ok: false,
          issues: [
            {
              code: 'ODDS_CONTAMINATION',
              path: '$',
              message: 'Generated plan contains odds contamination',
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
              message: 'Generated plan contains an accessor property',
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
          message: 'Generated plan contains uninspectable accessor',
        },
      ],
    };
  }

  return { ok: true, value: planResult.value };
}
