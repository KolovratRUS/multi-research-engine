import {
  MLB_TRAINING_MATRIX_CONTRACT_VERSION,
  MLB_TRAINING_TARGET_ENCODING,
  type MLBTrainingMatrixRow,
} from './mlb-training-matrix-contract';
import {
  MLB_MODEL_EVALUATION_PLAN_CONTRACT_VERSION,
  type MLBModelEvaluationPlan,
  validateMLBModelEvaluationPlan,
} from './mlb-model-training-plan-contract';

export const MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION =
  'mlb-pretest-validation-reference-facts-v1' as const;

export const MLB_PRETEST_GATE_POLICY_ID = 'FROZEN_PRETEST_GATE_POLICY_V1' as const;

export type MLBPreTestValidationReferenceFacts = Readonly<{
  contractVersion: typeof MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  matrixId: string;
  datasetId: string;
  evaluationPlanId: string;
  trainRowCount: number;
  validationRowCount: number;
  trainHomeWinCount: number;
  trainAwayWinCount: number;
  trainHomeWinPrior: number;
  p50: Readonly<{
    probability: number;
    validationLogLoss: number;
    validationBrierScore: number;
  }>;
  trainPrior: Readonly<{
    probability: number;
    validationLogLoss: number;
    validationBrierScore: number;
  }>;
}>;

export type MLBPreTestValidationReferenceFactsIssue = Readonly<{
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
    | 'TRAINING_MATRIX_INVALID'
    | 'EVALUATION_PLAN_INVALID'
    | 'SPLIT_VIOLATION'
    | 'TARGET_INVALID'
    | 'NONFINITE_BASELINE'
    | 'PROHIBITED_CONCEPT';
  path: string;
  message: string;
}>;

export type MLBPreTestValidationReferenceFactsInput = Readonly<{
  trainRows: readonly MLBTrainingMatrixRow[];
  validationRows: readonly MLBTrainingMatrixRow[];
  evaluationPlan: MLBModelEvaluationPlan;
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
  issues: MLBPreTestValidationReferenceFactsIssue[],
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
  issues: MLBPreTestValidationReferenceFactsIssue[],
  code: MLBPreTestValidationReferenceFactsIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function pushUniquePathCode(
  issues: MLBPreTestValidationReferenceFactsIssue[],
  next: MLBPreTestValidationReferenceFactsIssue,
): void {
  const exists = issues.some((item) => item.path === next.path && item.code === next.code);
  if (!exists) {
    issues.push(next);
  }
}

function sortIssues(
  issues: MLBPreTestValidationReferenceFactsIssue[],
): MLBPreTestValidationReferenceFactsIssue[] {
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
  issues: MLBPreTestValidationReferenceFactsIssue[],
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

const PROHIBITED_REFERENCE_FACTS_FIELDS = new Set([
  'testRowCount',
  'testTargets',
  'testProbabilities',
  'testMetrics',
  'testOutcomes',
  'testAccuracy',
]);

const KNOWN_REFERENCE_FACTS_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'matrixId',
  'datasetId',
  'evaluationPlanId',
  'trainRowCount',
  'validationRowCount',
  'trainHomeWinCount',
  'trainAwayWinCount',
  'trainHomeWinPrior',
  'p50',
  'trainPrior',
]);

const KNOWN_PRIOR_FIELDS = new Set(['probability', 'validationLogLoss', 'validationBrierScore']);

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
): string | MLBPreTestValidationReferenceFactsIssue {
  if (!isStrictNonEmptyTrimmedString(value)) {
    return {
      code: 'INVALID_STRING',
      path,
      message: `${label} must be a valid identifier`,
    };
  }
  return value;
}

function validatePositiveInteger(
  value: unknown,
  path: string,
  label: string,
  issues: MLBPreTestValidationReferenceFactsIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    pushIssue(issues, 'INVALID_INTEGER', path, `${label} must be a positive integer`);
    return undefined;
  }
  return value;
}

function validateNonNegativeInteger(
  value: unknown,
  path: string,
  label: string,
  issues: MLBPreTestValidationReferenceFactsIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    pushIssue(issues, 'INVALID_INTEGER', path, `${label} must be a non-negative integer`);
    return undefined;
  }
  return value;
}

function validateFiniteNumber(
  value: unknown,
  path: string,
  label: string,
  issues: MLBPreTestValidationReferenceFactsIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushIssue(issues, 'INVALID_NUMBER', path, `${label} must be finite`);
    return undefined;
  }
  return value;
}

function validatePriorObject(
  value: unknown,
  path: string,
  issues: MLBPreTestValidationReferenceFactsIssue[],
): Readonly<{
  probability: number;
  validationLogLoss: number;
  validationBrierScore: number;
}> | undefined {
  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, `${path} must be a plain object`);
    return undefined;
  }
  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, KNOWN_PRIOR_FIELDS, path, issues);

  const probabilityResult = ownDataProperty(root, 'probability', `${path}.probability`, issues);
  let probability: number | undefined;
  if (probabilityResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.probability`, 'probability is required');
  } else if (probabilityResult.kind === 'data') {
    probability = validateFiniteNumber(probabilityResult.value, `${path}.probability`, 'probability', issues);
  }

  const logLossResult = ownDataProperty(root, 'validationLogLoss', `${path}.validationLogLoss`, issues);
  let validationLogLoss: number | undefined;
  if (logLossResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.validationLogLoss`, 'validationLogLoss is required');
  } else if (logLossResult.kind === 'data') {
    validationLogLoss = validateFiniteNumber(logLossResult.value, `${path}.validationLogLoss`, 'validationLogLoss', issues);
  }

  const brierResult = ownDataProperty(root, 'validationBrierScore', `${path}.validationBrierScore`, issues);
  let validationBrierScore: number | undefined;
  if (brierResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.validationBrierScore`, 'validationBrierScore is required');
  } else if (brierResult.kind === 'data') {
    validationBrierScore = validateFiniteNumber(brierResult.value, `${path}.validationBrierScore`, 'validationBrierScore', issues);
  }

  if (probability !== undefined && validationLogLoss !== undefined && validationBrierScore !== undefined) {
    return { probability, validationLogLoss, validationBrierScore };
  }
  return undefined;
}

function validateRowTarget(
  row: MLBTrainingMatrixRow,
  path: string,
  issues: MLBPreTestValidationReferenceFactsIssue[],
): void {
  if (row.targetValue !== 0 && row.targetValue !== 1) {
    pushIssue(issues, 'TARGET_INVALID', path, 'targetValue must be 0 or 1');
  }
}

export function validateMLBPreTestValidationReferenceFacts(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBPreTestValidationReferenceFacts }>
  | Readonly<{ ok: false; issues: readonly MLBPreTestValidationReferenceFactsIssue[] }> {
  const issues: MLBPreTestValidationReferenceFactsIssue[] = [];

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;
  addKnownFieldIssues(root, KNOWN_REFERENCE_FACTS_FIELDS, '$', issues);

  for (const key of Object.getOwnPropertyNames(root)) {
    if (PROHIBITED_REFERENCE_FACTS_FIELDS.has(key)) {
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

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION}`,
      );
    }
  }

  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  if (sportResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.sport', 'sport is required');
  } else if (sportResult.kind === 'data' && sportResult.value !== 'MLB') {
    pushIssue(issues, 'INVALID_LITERAL', '$.sport', 'sport must be MLB');
  }

  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  if (targetResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.target', 'target is required');
  } else if (targetResult.kind === 'data' && targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER') {
    pushIssue(issues, 'INVALID_LITERAL', '$.target', 'target must be OFFICIAL_FINAL_GAME_WINNER');
  }

  const targetEncodingResult = ownDataProperty(root, 'targetEncoding', '$.targetEncoding', issues);
  if (targetEncodingResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.targetEncoding', 'targetEncoding is required');
  } else if (targetEncodingResult.kind === 'data' && targetEncodingResult.value !== 'HOME_WIN_1_AWAY_WIN_0') {
    pushIssue(
      issues,
      'INVALID_LITERAL',
      '$.targetEncoding',
      'targetEncoding must be HOME_WIN_1_AWAY_WIN_0',
    );
  }

  const matrixIdResult = ownDataProperty(root, 'matrixId', '$.matrixId', issues);
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

  const datasetIdResult = ownDataProperty(root, 'datasetId', '$.datasetId', issues);
  let datasetId: string | undefined;
  if (datasetIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetId', 'datasetId is required');
  } else if (datasetIdResult.kind === 'data') {
    const id = validateIdentifier(datasetIdResult.value, '$.datasetId', 'datasetId');
    if (typeof id === 'string') {
      datasetId = id;
    } else {
      issues.push(id);
    }
  }

  const evaluationPlanIdResult = ownDataProperty(
    root,
    'evaluationPlanId',
    '$.evaluationPlanId',
    issues,
  );
  let evaluationPlanId: string | undefined;
  if (evaluationPlanIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.evaluationPlanId', 'evaluationPlanId is required');
  } else if (evaluationPlanIdResult.kind === 'data') {
    const id = validateIdentifier(evaluationPlanIdResult.value, '$.evaluationPlanId', 'evaluationPlanId');
    if (typeof id === 'string') {
      evaluationPlanId = id;
    } else {
      issues.push(id);
    }
  }

  const trainRowCountResult = ownDataProperty(root, 'trainRowCount', '$.trainRowCount', issues);
  let trainRowCount: number | undefined;
  if (trainRowCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.trainRowCount', 'trainRowCount is required');
  } else if (trainRowCountResult.kind === 'data') {
    trainRowCount = validatePositiveInteger(trainRowCountResult.value, '$.trainRowCount', 'trainRowCount', issues);
  }

  const validationRowCountResult = ownDataProperty(
    root,
    'validationRowCount',
    '$.validationRowCount',
    issues,
  );
  let validationRowCount: number | undefined;
  if (validationRowCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.validationRowCount', 'validationRowCount is required');
  } else if (validationRowCountResult.kind === 'data') {
    validationRowCount = validatePositiveInteger(
      validationRowCountResult.value,
      '$.validationRowCount',
      'validationRowCount',
      issues,
    );
  }

  const trainHomeWinCountResult = ownDataProperty(
    root,
    'trainHomeWinCount',
    '$.trainHomeWinCount',
    issues,
  );
  let trainHomeWinCount: number | undefined;
  if (trainHomeWinCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.trainHomeWinCount', 'trainHomeWinCount is required');
  } else if (trainHomeWinCountResult.kind === 'data') {
    trainHomeWinCount = validateNonNegativeInteger(
      trainHomeWinCountResult.value,
      '$.trainHomeWinCount',
      'trainHomeWinCount',
      issues,
    );
  }

  const trainAwayWinCountResult = ownDataProperty(
    root,
    'trainAwayWinCount',
    '$.trainAwayWinCount',
    issues,
  );
  let trainAwayWinCount: number | undefined;
  if (trainAwayWinCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.trainAwayWinCount', 'trainAwayWinCount is required');
  } else if (trainAwayWinCountResult.kind === 'data') {
    trainAwayWinCount = validateNonNegativeInteger(
      trainAwayWinCountResult.value,
      '$.trainAwayWinCount',
      'trainAwayWinCount',
      issues,
    );
  }

  const trainHomeWinPriorResult = ownDataProperty(
    root,
    'trainHomeWinPrior',
    '$.trainHomeWinPrior',
    issues,
  );
  let trainHomeWinPrior: number | undefined;
  if (trainHomeWinPriorResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.trainHomeWinPrior', 'trainHomeWinPrior is required');
  } else if (trainHomeWinPriorResult.kind === 'data') {
    trainHomeWinPrior = validateFiniteNumber(
      trainHomeWinPriorResult.value,
      '$.trainHomeWinPrior',
      'trainHomeWinPrior',
      issues,
    );
    if (trainHomeWinPrior !== undefined) {
      if (trainHomeWinPrior < 0 || trainHomeWinPrior > 1) {
        pushIssue(
          issues,
          'INVALID_NUMBER',
          '$.trainHomeWinPrior',
          'trainHomeWinPrior must be in [0, 1]',
        );
      }
    }
  }

  const p50Result = ownDataProperty(root, 'p50', '$.p50', issues);
  let p50: { probability: number; validationLogLoss: number; validationBrierScore: number } | undefined;
  if (p50Result.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.p50', 'p50 is required');
  } else if (p50Result.kind === 'data') {
    p50 = validatePriorObject(p50Result.value, '$.p50', issues);
    if (p50 && p50.probability !== undefined && p50.probability !== 0.5) {
      pushIssue(
        issues,
        'INVALID_NUMBER',
        '$.p50.probability',
        'p50.probability must be exactly 0.5',
      );
    }
  }

  const trainPriorResult = ownDataProperty(root, 'trainPrior', '$.trainPrior', issues);
  let trainPrior: { probability: number; validationLogLoss: number; validationBrierScore: number } | undefined;
  if (trainPriorResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.trainPrior', 'trainPrior is required');
  } else if (trainPriorResult.kind === 'data') {
    trainPrior = validatePriorObject(trainPriorResult.value, '$.trainPrior', issues);
    if (
      trainPrior &&
      trainPrior.probability !== undefined &&
      trainHomeWinPrior !== undefined &&
      trainPrior.probability !== trainHomeWinPrior
    ) {
      pushIssue(
        issues,
        'INVALID_NUMBER',
        '$.trainPrior.probability',
        'trainPrior.probability must equal trainHomeWinPrior',
      );
    }
  }

  if (
    trainRowCount !== undefined &&
    validationRowCount !== undefined &&
    trainHomeWinCount !== undefined &&
    trainAwayWinCount !== undefined &&
    trainHomeWinPrior !== undefined &&
    trainHomeWinCount + trainAwayWinCount !== trainRowCount
  ) {
    pushIssue(
      issues,
      'INVALID_INTEGER',
      '$.trainHomeWinCount',
      'trainHomeWinCount + trainAwayWinCount must equal trainRowCount',
    );
  }

  if (
    trainHomeWinPrior !== undefined &&
    trainRowCount !== undefined &&
    trainRowCount > 0 &&
    p50 &&
    trainPrior &&
    p50.validationLogLoss !== undefined &&
    p50.validationBrierScore !== undefined &&
    trainPrior.validationLogLoss !== undefined &&
    trainPrior.validationBrierScore !== undefined
  ) {
    if (!Number.isFinite(p50.validationLogLoss) || !Number.isFinite(p50.validationBrierScore)) {
      pushUniquePathCode(
        issues,
        { code: 'NONFINITE_BASELINE', path: '$.p50', message: 'P50 baseline metrics must be finite' },
      );
    }
    if (!Number.isFinite(trainPrior.validationLogLoss) || !Number.isFinite(trainPrior.validationBrierScore)) {
      pushUniquePathCode(
        issues,
        { code: 'NONFINITE_BASELINE', path: '$.trainPrior', message: 'TRAIN-prior baseline metrics must be finite' },
      );
    }
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  const result: MLBPreTestValidationReferenceFacts = {
    contractVersion: MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    matrixId: matrixId ?? '',
    datasetId: datasetId ?? '',
    evaluationPlanId: evaluationPlanId ?? '',
    trainRowCount: trainRowCount ?? 0,
    validationRowCount: validationRowCount ?? 0,
    trainHomeWinCount: trainHomeWinCount ?? 0,
    trainAwayWinCount: trainAwayWinCount ?? 0,
    trainHomeWinPrior: trainHomeWinPrior ?? 0,
    p50: {
      probability: 0.5,
      validationLogLoss: p50 ? p50.validationLogLoss : 0,
      validationBrierScore: p50 ? p50.validationBrierScore : 0,
    },
    trainPrior: {
      probability: trainHomeWinPrior ?? 0,
      validationLogLoss: trainPrior ? trainPrior.validationLogLoss : 0,
      validationBrierScore: trainPrior ? trainPrior.validationBrierScore : 0,
    },
  };

  return { ok: true, value: result };
}

export function buildMLBPreTestValidationReferenceFacts(
  input: MLBPreTestValidationReferenceFactsInput,
):
  | Readonly<{ ok: true; value: MLBPreTestValidationReferenceFacts }>
  | Readonly<{ ok: false; issues: readonly MLBPreTestValidationReferenceFactsIssue[] }> {
  const issues: MLBPreTestValidationReferenceFactsIssue[] = [];

  if (!isPlainObject(input)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.input', 'input must be a plain object');
    return { ok: false, issues: sortIssues(issues) };
  }
  const root = input as Record<string, unknown>;

  const trainRowsResult = ownDataProperty(root, 'trainRows', '$.input.trainRows', issues);
  let trainRows: readonly MLBTrainingMatrixRow[] | null = null;
  if (trainRowsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.input.trainRows', 'trainRows is required');
  } else if (trainRowsResult.kind === 'accessor') {
    // accessor, fail closed
  } else if (!Array.isArray(trainRowsResult.value)) {
    pushIssue(issues, 'INVALID_ARRAY', '$.input.trainRows', 'trainRows must be an array');
  } else {
    trainRows = trainRowsResult.value as readonly MLBTrainingMatrixRow[];
  }

  const validationRowsResult = ownDataProperty(root, 'validationRows', '$.input.validationRows', issues);
  let validationRows: readonly MLBTrainingMatrixRow[] | null = null;
  if (validationRowsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.input.validationRows', 'validationRows is required');
  } else if (validationRowsResult.kind === 'accessor') {
    // accessor, fail closed
  } else if (!Array.isArray(validationRowsResult.value)) {
    pushIssue(issues, 'INVALID_ARRAY', '$.input.validationRows', 'validationRows must be an array');
  } else {
    validationRows = validationRowsResult.value as readonly MLBTrainingMatrixRow[];
  }

  const evaluationPlanResult = ownDataProperty(root, 'evaluationPlan', '$.input.evaluationPlan', issues);
  let evaluationPlan: MLBModelEvaluationPlan | null = null;
  if (evaluationPlanResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.input.evaluationPlan', 'evaluationPlan is required');
  } else if (evaluationPlanResult.kind === 'accessor') {
    // accessor, fail closed
  } else if (!isPlainObject(evaluationPlanResult.value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.input.evaluationPlan', 'evaluationPlan must be a plain object');
  } else {
    const planValidation = validateMLBModelEvaluationPlan(
      evaluationPlanResult.value as Record<string, unknown>,
    );
    if (!planValidation.ok) {
      pushIssue(issues, 'EVALUATION_PLAN_INVALID', '$.input.evaluationPlan', 'evaluationPlan is invalid');
      evaluationPlan = null;
    } else {
      evaluationPlan = planValidation.value;
    }
  }

  if (trainRows === null || validationRows === null || evaluationPlan === null) {
    return { ok: false, issues: sortIssues(issues) };
  }

  if (trainRows.length === 0) {
    pushIssue(issues, 'INVALID_INTEGER', '$.input.trainRows', 'trainRows must not be empty');
  }
  if (validationRows.length === 0) {
    pushIssue(issues, 'INVALID_INTEGER', '$.input.validationRows', 'validationRows must not be empty');
  }

  let trainHomeWinCount = 0;
  let trainAwayWinCount = 0;
  for (const row of trainRows) {
    if (row.split !== 'TRAIN') {
      pushIssue(issues, 'SPLIT_VIOLATION', `$.input.trainRows[${row.exampleId}]`, 'Expected TRAIN split');
    }
    validateRowTarget(row, `$.input.trainRows[${row.exampleId}]`, issues);
    if (row.targetValue === 1) {
      trainHomeWinCount += 1;
    } else if (row.targetValue === 0) {
      trainAwayWinCount += 1;
    }
  }

  let validationRowCount = 0;
  for (const row of validationRows) {
    if (row.split !== 'VALIDATION') {
      pushIssue(
        issues,
        'SPLIT_VIOLATION',
        `$.input.validationRows[${row.exampleId}]`,
        'Expected VALIDATION split',
      );
    }
    validateRowTarget(row, `$.input.validationRows[${row.exampleId}]`, issues);
    validationRowCount += 1;
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const trainRowCount = trainRows.length;
  if (trainHomeWinCount + trainAwayWinCount !== trainRowCount) {
    pushIssue(
      issues,
      'INVALID_INTEGER',
      '$.input.trainRows',
      'trainHomeWinCount + trainAwayWinCount must equal trainRowCount',
    );
  }

  const trainHomeWinPrior = trainHomeWinCount / trainRowCount;
  const p50Probability = 0.5;

  let p50LogLoss = 0;
  let p50Brier = 0;
  let trainPriorLogLoss = 0;
  let trainPriorBrier = 0;

  for (const row of validationRows) {
    const target = row.targetValue;
    p50LogLoss += calculateClippedLogLoss(p50Probability, target);
    p50Brier += brierScore(p50Probability, target);
    trainPriorLogLoss += calculateClippedLogLoss(trainHomeWinPrior, target);
    trainPriorBrier += brierScore(trainHomeWinPrior, target);
  }

  p50LogLoss /= validationRowCount;
  p50Brier /= validationRowCount;
  trainPriorLogLoss /= validationRowCount;
  trainPriorBrier /= validationRowCount;

  if (!Number.isFinite(p50LogLoss) || !Number.isFinite(p50Brier)) {
    pushUniquePathCode(
      issues,
      { code: 'NONFINITE_BASELINE', path: '$.p50', message: 'P50 baseline metrics must be finite' },
    );
  }
  if (!Number.isFinite(trainPriorLogLoss) || !Number.isFinite(trainPriorBrier)) {
    pushUniquePathCode(
      issues,
      { code: 'NONFINITE_BASELINE', path: '$.trainPrior', message: 'TRAIN-prior baseline metrics must be finite' },
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  const result: MLBPreTestValidationReferenceFacts = {
    contractVersion: MLB_PRETEST_VALIDATION_REFERENCE_FACTS_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    matrixId: evaluationPlan.matrixId,
    datasetId: evaluationPlan.datasetId,
    evaluationPlanId: evaluationPlan.planId,
    trainRowCount,
    validationRowCount,
    trainHomeWinCount,
    trainAwayWinCount,
    trainHomeWinPrior,
    p50: { probability: p50Probability, validationLogLoss: p50LogLoss, validationBrierScore: p50Brier },
    trainPrior: {
      probability: trainHomeWinPrior,
      validationLogLoss: trainPriorLogLoss,
      validationBrierScore: trainPriorBrier,
    },
  };

  const validationIssues = validateMLBPreTestValidationReferenceFacts(result);
  if (!validationIssues.ok) {
    return { ok: false, issues: validationIssues.issues };
  }

  return { ok: true, value: validationIssues.value };
}

function calculateClippedLogLoss(probability: number, target: number): number {
  const clamped = Math.max(1e-15, Math.min(1 - 1e-15, probability));
  return -(target * Math.log(clamped) + (1 - target) * Math.log(1 - clamped));
}

function brierScore(probability: number, target: number): number {
  return (probability - target) ** 2;
}
