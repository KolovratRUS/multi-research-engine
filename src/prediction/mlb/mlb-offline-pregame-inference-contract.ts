import {
  assertNoOddsContamination,
} from '../firewall/odds-contamination-guard';
import {
  validateMLBCanonicalPregameSnapshot,
} from './mlb-pregame-snapshot-contract';
import {
  validateMLBFeatureManifest,
  validateMLBFeatureVector,
  extractMLBLeakageSafeFeatureVector,
} from './mlb-feature-vector-contract';
import {
  validateMLBModelTestReleaseResult,
  validateMLBModelTestEvaluation,
  validateMLBModelReleaseRecord,
} from './mlb-model-test-release-contract';
import {
  validateMLBModelFitValidationResult,
} from './mlb-logistic-regression-fit-contract';

export const MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION =
  'mlb-offline-pregame-inference-v1' as const;

export const MLB_OFFLINE_PREGAME_DECISION_POLICY =
  'HOME_AT_OR_ABOVE_0_5_V1' as const;

export type MLBOfflinePregamePredictedSide = 'HOME' | 'AWAY';

export type MLBOfflinePregameProbabilityPair = Readonly<{
  homeWinProbability: number;
  awayWinProbability: number;
}>;

export type MLBOfflinePregameInference = Readonly<{
  contractVersion: 'mlb-offline-pregame-inference-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  inferenceId: string;
  releaseId: string;
  modelId: string;
  planId: string;
  matrixId: string;
  configId: string;
  manifestId: string;
  snapshotId: string;
  gameId: string;
  officialDate: string;
  dataCutoffAt: string;
  algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1';
  decisionPolicy: 'HOME_AT_OR_ABOVE_0_5_V1';
  homeTeamId: string;
  awayTeamId: string;
  probabilities: MLBOfflinePregameProbabilityPair;
  predictedSide: MLBOfflinePregamePredictedSide;
  predictedTeamId: string;
}>;

export type MLBOfflinePregameInferenceIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'RELEASE_RESULT_INVALID'
    | 'RELEASE_STATUS_MISMATCH'
    | 'MANIFEST_INVALID'
    | 'SNAPSHOT_INVALID'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'FEATURE_SCHEMA_MISMATCH'
    | 'FEATURE_EXTRACTION_FAILED'
    | 'NUMERICAL_FAILURE'
    | 'INFERENCE_ID_MISMATCH'
    | 'PROBABILITY_MISMATCH'
    | 'WINNER_MISMATCH'
    | 'GENERATED_INFERENCE_INVALID'
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


function ownDataPropertyOfRecord(
  target: Record<string, unknown>,
  key: string,
): 'missing' | 'accessor' | { kind: 'data'; value: unknown } {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return 'missing';
  }
  if (!isDataDescriptor(descriptor)) {
    return 'accessor';
  }
  return { kind: 'data', value: descriptor.value };
}

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBOfflinePregameInferenceIssue[],
): 'missing' | 'accessor' | { kind: 'data'; value: unknown } {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor) {
    return 'missing';
  }
  if (!isDataDescriptor(descriptor)) {
    issues.push({
      code: 'INVALID_JSON_VALUE',
      path,
      message: `Accessor property: ${key}`,
    });
    return 'accessor';
  }
  return { kind: 'data', value: descriptor.value };
}

function pushUniqueIssue(
  issues: MLBOfflinePregameInferenceIssue[],
  issue: MLBOfflinePregameInferenceIssue,
): void {
  const exists = issues.some(
    (item) => item.path === issue.path && item.code === issue.code,
  );
  if (!exists) {
    issues.push(issue);
  }
}

function normalizeIssues(
  issues: MLBOfflinePregameInferenceIssue[],
): readonly MLBOfflinePregameInferenceIssue[] {
  const unique = new Map<string, MLBOfflinePregameInferenceIssue>();
  for (const issue of issues) {
    const key = `${issue.path}\u0000${issue.code}`;
    if (!unique.has(key)) {
      unique.set(key, issue);
    }
  }
  return Array.from(unique.values()).sort((a, b) => {
    const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
    if (pathDiff !== 0) return pathDiff;
    const codeDiff = a.code < b.code ? -1 : b.code < a.code ? 1 : 0;
    return codeDiff;
  });
}

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function isValidGregorianDate(value: string): boolean {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidRfc3339Timestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    value === value.trim()
  );
}

const KNOWN_INFERENCE_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'inferenceId',
  'releaseId',
  'modelId',
  'planId',
  'matrixId',
  'configId',
  'manifestId',
  'snapshotId',
  'gameId',
  'officialDate',
  'dataCutoffAt',
  'algorithm',
  'decisionPolicy',
  'homeTeamId',
  'awayTeamId',
  'probabilities',
  'predictedSide',
  'predictedTeamId',
]);

const PROHIBITED_INFERENCE_FIELDS = new Set([
  'featureManifest',
  'snapshot',
  'featureVector',
  'features',
  'values',
  'wasMissing',
  'coefficients',
  'intercept',
  'score',
  'linearScore',
  'trainingRows',
  'validationMetrics',
  'testMetrics',
  'label',
  'targetValue',
  'homeRuns',
  'awayRuns',
  'winnerTeamId',
  'finalizedAt',
  'source',
  'odds',
  'moneyline',
  'spread',
  'total',
  'impliedProbability',
  'marketProbability',
  'value',
  'edge',
  'recommendation',
  'selection',
  'multi',
  'parlay',
  'stake',
  'grading',
  'deployment',
  'endpoint',
]);

function validateProbabilityPair(
  value: unknown,
): MLBOfflinePregameInferenceIssue[] {
  const issues: MLBOfflinePregameInferenceIssue[] = [];
  const basePath = '$.probabilities';

  if (!isPlainObject(value)) {
    issues.push({
      code: 'NOT_PLAIN_OBJECT',
      path: basePath,
      message: 'probabilities must be a plain object',
    });
    return issues;
  }

  const root = value as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(root)) {
    issues.push({
      code: 'UNKNOWN_FIELD',
      path: `${basePath}[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_INFERENCE_FIELDS.has(key) && key !== 'homeWinProbability' && key !== 'awayWinProbability') {
      if (PROHIBITED_INFERENCE_FIELDS.has(key)) {
        issues.push({
          code: 'PROHIBITED_CONCEPT',
          path: `${basePath}.${key}`,
          message: `Prohibited field: ${key}`,
        });
      } else {
        issues.push({
          code: 'UNKNOWN_FIELD',
          path: `${basePath}.${key}`,
          message: `Unknown field: ${key}`,
        });
      }
    }
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (descriptor && !isDataDescriptor(descriptor)) {
      issues.push({
        code: 'INVALID_JSON_VALUE',
        path: `${basePath}.${key}`,
        message: `Accessor property: ${key}`,
      });
    }
  }

  const homeResult = ownDataProperty(
    root,
    'homeWinProbability',
    `${basePath}.homeWinProbability`,
    issues,
  );
  if (homeResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${basePath}.homeWinProbability`,
      message: 'homeWinProbability is required',
    });
  } else if (homeResult !== 'accessor') {
    const homeValue = (homeResult as { kind: 'data'; value: unknown }).value;
    if (
      typeof homeValue !== 'number' ||
      !Number.isFinite(homeValue) ||
      homeValue < 0 ||
      homeValue > 1 ||
      Object.is(homeValue, -0)
    ) {
      issues.push({
        code: 'INVALID_NUMBER',
        path: `${basePath}.homeWinProbability`,
        message: 'homeWinProbability must be a finite number in [0, 1]',
      });
    }
  }

  const awayResult = ownDataProperty(
    root,
    'awayWinProbability',
    `${basePath}.awayWinProbability`,
    issues,
  );
  if (awayResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${basePath}.awayWinProbability`,
      message: 'awayWinProbability is required',
    });
  } else if (awayResult !== 'accessor') {
    const awayValue = (awayResult as { kind: 'data'; value: unknown }).value;
    if (
      typeof awayValue !== 'number' ||
      !Number.isFinite(awayValue) ||
      awayValue < 0 ||
      awayValue > 1 ||
      Object.is(awayValue, -0)
    ) {
      issues.push({
        code: 'INVALID_NUMBER',
        path: `${basePath}.awayWinProbability`,
        message: 'awayWinProbability must be a finite number in [0, 1]',
      });
    }
  }

  if (homeResult !== 'missing' && homeResult !== 'accessor' && awayResult !== 'missing' && awayResult !== 'accessor') {
    const homeValue = (homeResult as { kind: 'data'; value: unknown }).value as number;
    const awayValue = (awayResult as { kind: 'data'; value: unknown }).value as number;
    if (awayValue !== 1 - homeValue) {
      issues.push({
        code: 'PROBABILITY_MISMATCH',
        path: basePath,
        message: 'awayWinProbability must equal 1 - homeWinProbability',
      });
    }
  }

  return issues;
}

export function validateMLBOfflinePregameInference(
  value: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflinePregameInference;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflinePregameInferenceIssue[];
    }> {
  const issues: MLBOfflinePregameInferenceIssue[] = [];

  if (!isPlainObject(value)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Inference must be a plain object' },
      ]),
    };
  }

  const root = value as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `$[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_INFERENCE_FIELDS.has(key)) {
      if (PROHIBITED_INFERENCE_FIELDS.has(key)) {
        pushUniqueIssue(issues, {
          code: 'PROHIBITED_CONCEPT',
          path: `$.${key}`,
          message: `Prohibited field: ${key}`,
        });
      } else {
        pushUniqueIssue(issues, {
          code: 'UNKNOWN_FIELD',
          path: `$.${key}`,
          message: `Unknown field: ${key}`,
        });
      }
    }
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (KNOWN_INFERENCE_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: `$.${key}`,
          message: `Accessor property: ${key}`,
        });
      }
    }
  }

  const contractVersionResult = ownDataProperty(
    root,
    'contractVersion',
    '$.contractVersion',
    issues,
  );
  if (contractVersionResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.contractVersion',
      message: 'contractVersion is required',
    });
  } else if (contractVersionResult !== 'accessor') {
    const contractVersion = (contractVersionResult as { kind: 'data'; value: unknown }).value;
    if (contractVersion !== MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.contractVersion',
        message: `contractVersion must be ${MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION}`,
      });
    }
  }

  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  if (sportResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sport',
      message: 'sport is required',
    });
  } else if (sportResult !== 'accessor') {
    const sport = (sportResult as { kind: 'data'; value: unknown }).value;
    if (sport !== 'MLB') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.sport',
        message: 'sport must be MLB',
      });
    }
  }

  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  if (targetResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.target',
      message: 'target is required',
    });
  } else if (targetResult !== 'accessor') {
    const target = (targetResult as { kind: 'data'; value: unknown }).value;
    if (target !== 'OFFICIAL_FINAL_GAME_WINNER') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.target',
        message: 'target must be OFFICIAL_FINAL_GAME_WINNER',
      });
    }
  }

  const targetEncodingResult = ownDataProperty(
    root,
    'targetEncoding',
    '$.targetEncoding',
    issues,
  );
  if (targetEncodingResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.targetEncoding',
      message: 'targetEncoding is required',
    });
  } else if (targetEncodingResult !== 'accessor') {
    const targetEncoding = (targetEncodingResult as { kind: 'data'; value: unknown }).value;
    if (targetEncoding !== 'HOME_WIN_1_AWAY_WIN_0') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.targetEncoding',
        message: 'targetEncoding must be HOME_WIN_1_AWAY_WIN_0',
      });
    }
  }

  const inferenceIdResult = ownDataProperty(
    root,
    'inferenceId',
    '$.inferenceId',
    issues,
  );
  if (inferenceIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.inferenceId',
      message: 'inferenceId is required',
    });
  } else if (inferenceIdResult !== 'accessor') {
    const inferenceId = (inferenceIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(inferenceId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.inferenceId',
        message: 'inferenceId must be a valid identifier',
      });
    } else {
      const releaseIdResult = ownDataProperty(root, 'releaseId', '$.releaseId', issues);
      const releaseId =
        releaseIdResult !== 'missing' && releaseIdResult !== 'accessor'
          ? (releaseIdResult as { kind: 'data'; value: unknown }).value
          : null;
      const snapshotIdResult = ownDataProperty(
        root,
        'snapshotId',
        '$.snapshotId',
        issues,
      );
      const snapshotId =
        snapshotIdResult !== 'missing' && snapshotIdResult !== 'accessor'
          ? (snapshotIdResult as { kind: 'data'; value: unknown }).value
          : null;
      const expectedSuffix = '::offline-pregame-inference-v1';
      if (typeof releaseId === 'string' && typeof snapshotId === 'string') {
        const expected = `${releaseId}::${snapshotId}::offline-pregame-inference-v1`;
        if (inferenceId !== expected) {
          pushUniqueIssue(issues, {
            code: 'INFERENCE_ID_MISMATCH',
            path: '$.inferenceId',
            message: 'inferenceId does not match releaseId::snapshotId::offline-pregame-inference-v1',
          });
        }
      }
    }
  }

  const identifierFields = [
    'releaseId',
    'modelId',
    'planId',
    'matrixId',
    'configId',
    'manifestId',
    'snapshotId',
    'gameId',
  ];
  for (const field of identifierFields) {
    const fieldResult = ownDataProperty(root, field, `$.${field}`, issues);
    if (fieldResult === 'missing') {
      pushUniqueIssue(issues, {
        code: 'MISSING_FIELD',
        path: `$.${field}`,
        message: `${field} is required`,
      });
    } else if (fieldResult !== 'accessor') {
      const value = (fieldResult as { kind: 'data'; value: unknown }).value;
      if (!isStrictNonEmptyTrimmedString(value)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_STRING',
          path: `$.${field}`,
          message: `${field} must be a valid identifier`,
        });
      }
    }
  }

  const officialDateResult = ownDataProperty(
    root,
    'officialDate',
    '$.officialDate',
    issues,
  );
  if (officialDateResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.officialDate',
      message: 'officialDate is required',
    });
  } else if (officialDateResult !== 'accessor') {
    const officialDate = (officialDateResult as { kind: 'data'; value: unknown }).value;
    if (typeof officialDate !== 'string' || !isValidGregorianDate(officialDate)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.officialDate',
        message: 'officialDate must be a valid calendar date',
      });
    }
  }

  const dataCutoffAtResult = ownDataProperty(
    root,
    'dataCutoffAt',
    '$.dataCutoffAt',
    issues,
  );
  if (dataCutoffAtResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.dataCutoffAt',
      message: 'dataCutoffAt is required',
    });
  } else if (dataCutoffAtResult !== 'accessor') {
    const dataCutoffAt = (dataCutoffAtResult as { kind: 'data'; value: unknown }).value;
    if (typeof dataCutoffAt !== 'string' || !isValidRfc3339Timestamp(dataCutoffAt)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.dataCutoffAt',
        message: 'dataCutoffAt must be an RFC3339 timestamp',
      });
    }
  }

  const algorithmResult = ownDataProperty(root, 'algorithm', '$.algorithm', issues);
  if (algorithmResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.algorithm',
      message: 'algorithm is required',
    });
  } else if (algorithmResult !== 'accessor') {
    const algorithm = (algorithmResult as { kind: 'data'; value: unknown }).value;
    if (algorithm !== 'L2_LOGISTIC_REGRESSION_BINARY_V1') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.algorithm',
        message: 'algorithm must be L2_LOGISTIC_REGRESSION_BINARY_V1',
      });
    }
  }

  const decisionPolicyResult = ownDataProperty(
    root,
    'decisionPolicy',
    '$.decisionPolicy',
    issues,
  );
  if (decisionPolicyResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.decisionPolicy',
      message: 'decisionPolicy is required',
    });
  } else if (decisionPolicyResult !== 'accessor') {
    const decisionPolicy = (decisionPolicyResult as { kind: 'data'; value: unknown }).value;
    if (decisionPolicy !== 'HOME_AT_OR_ABOVE_0_5_V1') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.decisionPolicy',
        message: 'decisionPolicy must be HOME_AT_OR_ABOVE_0_5_V1',
      });
    }
  }

  const homeTeamIdResult = ownDataProperty(
    root,
    'homeTeamId',
    '$.homeTeamId',
    issues,
  );
  if (homeTeamIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.homeTeamId',
      message: 'homeTeamId is required',
    });
  } else if (homeTeamIdResult !== 'accessor') {
    const homeTeamId = (homeTeamIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(homeTeamId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.homeTeamId',
        message: 'homeTeamId must be a valid identifier',
      });
    }
  }

  const awayTeamIdResult = ownDataProperty(
    root,
    'awayTeamId',
    '$.awayTeamId',
    issues,
  );
  if (awayTeamIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.awayTeamId',
      message: 'awayTeamId is required',
    });
  } else if (awayTeamIdResult !== 'accessor') {
    const awayTeamId = (awayTeamIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(awayTeamId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.awayTeamId',
        message: 'awayTeamId must be a valid identifier',
      });
    }
  }

  if (
    homeTeamIdResult !== 'missing' &&
    homeTeamIdResult !== 'accessor' &&
    awayTeamIdResult !== 'missing' &&
    awayTeamIdResult !== 'accessor'
  ) {
  }

  const probabilitiesResult = ownDataProperty(
    root,
    'probabilities',
    '$.probabilities',
    issues,
  );
  if (probabilitiesResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.probabilities',
      message: 'probabilities is required',
    });
  } else if (probabilitiesResult !== 'accessor') {
    const probabilities = (probabilitiesResult as { kind: 'data'; value: unknown }).value;
    issues.push(...validateProbabilityPair(probabilities));
  }

  const predictedSideResult = ownDataProperty(
    root,
    'predictedSide',
    '$.predictedSide',
    issues,
  );
  if (predictedSideResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.predictedSide',
      message: 'predictedSide is required',
    });
  } else if (predictedSideResult !== 'accessor') {
    const predictedSide = (predictedSideResult as { kind: 'data'; value: unknown }).value;
    if (predictedSide !== 'HOME' && predictedSide !== 'AWAY') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.predictedSide',
        message: 'predictedSide must be HOME or AWAY',
      });
    }
  }

  const predictedTeamIdResult = ownDataProperty(
    root,
    'predictedTeamId',
    '$.predictedTeamId',
    issues,
  );
  if (predictedTeamIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.predictedTeamId',
      message: 'predictedTeamId is required',
    });
  } else if (predictedTeamIdResult !== 'accessor') {
    const predictedTeamId = (predictedTeamIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(predictedTeamId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.predictedTeamId',
        message: 'predictedTeamId must be a valid identifier',
      });
    }
  }

  if (
    probabilitiesResult !== 'missing' &&
    probabilitiesResult !== 'accessor' &&
    homeTeamIdResult !== 'missing' &&
    homeTeamIdResult !== 'accessor' &&
    awayTeamIdResult !== 'missing' &&
    awayTeamIdResult !== 'accessor' &&
    predictedSideResult !== 'missing' &&
    predictedSideResult !== 'accessor' &&
    predictedTeamIdResult !== 'missing' &&
    predictedTeamIdResult !== 'accessor'
  ) {
    const homeValue = (probabilitiesResult as { kind: 'data'; value: unknown }).value as Record<string, unknown>;
    const homeWinProbabilityResult = ownDataPropertyOfRecord(homeValue, 'homeWinProbability');
    const probabilityBasePath = '$.probabilities';
    if (homeWinProbabilityResult === 'missing') {
      pushUniqueIssue(issues, {
        code: 'MISSING_FIELD',
        path: `${probabilityBasePath}.homeWinProbability`,
        message: 'homeWinProbability is required',
      });
    } else if (homeWinProbabilityResult !== 'accessor') {
      const homeWinProbability = (homeWinProbabilityResult as { kind: 'data'; value: unknown }).value as number;
      const predictedSide = (predictedSideResult as { kind: 'data'; value: unknown }).value as string;
      const predictedTeamId = (predictedTeamIdResult as { kind: 'data'; value: unknown }).value as string;
      const homeTeamId = (homeTeamIdResult as { kind: 'data'; value: unknown }).value as string;
      const awayTeamId = (awayTeamIdResult as { kind: 'data'; value: unknown }).value as string;

      if (
        typeof homeWinProbability !== 'number' ||
        !Number.isFinite(homeWinProbability) ||
        homeWinProbability < 0 ||
        homeWinProbability > 1 ||
        Object.is(homeWinProbability, -0)
      ) {
        pushUniqueIssue(issues, {
          code: 'INVALID_NUMBER',
          path: `${probabilityBasePath}.homeWinProbability`,
          message: 'homeWinProbability must be a finite number in [0, 1]',
        });
      }

      if (homeWinProbability >= 0.5) {
        if (predictedSide !== 'HOME') {
          pushUniqueIssue(issues, {
            code: 'WINNER_MISMATCH',
            path: '$.predictedSide',
            message: 'predictedSide must be HOME when homeWinProbability >= 0.5',
          });
        }
        if (predictedTeamId !== homeTeamId) {
          pushUniqueIssue(issues, {
            code: 'WINNER_MISMATCH',
            path: '$.predictedTeamId',
            message: 'predictedTeamId must match homeTeamId when predictedSide is HOME',
          });
        }
      } else {
        if (predictedSide !== 'AWAY') {
          pushUniqueIssue(issues, {
            code: 'WINNER_MISMATCH',
            path: '$.predictedSide',
            message: 'predictedSide must be AWAY when homeWinProbability < 0.5',
          });
        }
        if (predictedTeamId !== awayTeamId) {
          pushUniqueIssue(issues, {
            code: 'WINNER_MISMATCH',
            path: '$.predictedTeamId',
            message: 'predictedTeamId must match awayTeamId when predictedSide is AWAY',
          });
        }
      }
    }
  }

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ODDS_CONTAMINATION')) {
      pushUniqueIssue(issues, {
        code: 'ODDS_CONTAMINATION',
        path: '$',
        message: 'Odds contamination detected',
      });
    } else {
      pushUniqueIssue(issues, {
        code: 'INVALID_JSON_VALUE',
        path: '$',
        message: 'Uninspectable accessor property',
      });
    }
  }

  const finalIssues = normalizeIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBOfflinePregameInference };
}

function stableSigmoid(score: number): number {
  if (score >= 0) {
    return 1 / (1 + Math.exp(-score));
  }
  return Math.exp(score) / (1 + Math.exp(score));
}

export function inferMLBOfflinePregameWinner(
  releasedModelResult: unknown,
  featureManifest: unknown,
  snapshot: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflinePregameInference;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflinePregameInferenceIssue[];
    }> {
  const issues: MLBOfflinePregameInferenceIssue[] = [];

  const releaseValidation = validateMLBModelTestReleaseResult(releasedModelResult);
  if (!releaseValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'RELEASE_RESULT_INVALID', path: '$.releasedModelResult', message: 'Invalid release result' },
      ]),
    };
  }

  const fitValidationValidation = validateMLBModelFitValidationResult(releaseValidation.value.fitValidation);
  if (!fitValidationValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'RELEASE_RESULT_INVALID', path: '$.releasedModelResult.fitValidation', message: 'Invalid fit validation result' },
      ]),
    };
  }

  const testEvaluationValidation = validateMLBModelTestEvaluation(releaseValidation.value.test);
  if (!testEvaluationValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'RELEASE_RESULT_INVALID', path: '$.releasedModelResult.test', message: 'Invalid test evaluation' },
      ]),
    };
  }

  const releaseRecordValidation = validateMLBModelReleaseRecord(releaseValidation.value.release);
  if (!releaseRecordValidation.ok) {
    const releaseIssues = releaseRecordValidation.issues;
    const issue = releaseIssues[0];
    const isReleaseStatusOnlyFailure =
      releaseIssues.length === 1
      && issue.code === 'INVALID_LITERAL'
      && issue.path === '$.releaseStatus';
    if (isReleaseStatusOnlyFailure) {
      return {
        ok: false,
        issues: normalizeIssues([
          {
            code: 'RELEASE_STATUS_MISMATCH',
            path: '$.releasedModelResult.release.releaseStatus',
            message: 'Release status must be OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED',
          },
        ]),
      };
    }
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'RELEASE_RESULT_INVALID', path: '$.releasedModelResult.release', message: 'Invalid release record' },
      ]),
    };
  }

  const manifestValidation = validateMLBFeatureManifest(featureManifest);
  if (!manifestValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'MANIFEST_INVALID', path: '$.featureManifest', message: 'Invalid feature manifest' },
      ]),
    };
  }

  const snapshotValidation = validateMLBCanonicalPregameSnapshot(snapshot);
  if (!snapshotValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'SNAPSHOT_INVALID', path: '$.snapshot', message: 'Invalid snapshot' },
      ]),
    };
  }

  const fitValidation = fitValidationValidation.value;
  const testEvaluation = testEvaluationValidation.value;
  const releaseRecord = releaseRecordValidation.value;
  const manifest = manifestValidation.value;
  const snap = snapshotValidation.value;

  const model = fitValidation.model;

  if (model.manifestId !== manifest.manifestId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.manifestId',
          message: 'Model manifestId does not match manifest manifestId',
        },
      ]),
    };
  }

  if (model.sport !== manifest.sport) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.sport',
          message: 'Model sport does not match manifest sport',
        },
      ]),
    };
  }

  if (model.target !== manifest.target) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.target',
          message: 'Model target does not match manifest target',
        },
      ]),
    };
  }

  const modelFeatureIds = Array.from(model.featureIds);
  const manifestFeatureIds = manifest.features.map((f) => f.featureId);
  const coefficientFeatureIds = model.coefficients.map((c) => c.featureId);

  if (modelFeatureIds.length !== manifestFeatureIds.length) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'FEATURE_SCHEMA_MISMATCH',
          path: '$.featureIds',
          message: 'Model featureIds count does not match manifest features count',
        },
      ]),
    };
  }

  for (let i = 0; i < modelFeatureIds.length; i++) {
    if (modelFeatureIds[i] !== manifestFeatureIds[i]) {
      return {
        ok: false,
        issues: normalizeIssues([
          {
            code: 'FEATURE_SCHEMA_MISMATCH',
            path: '$.featureIds',
            message: 'Model featureIds do not match manifest featureIds',
          },
        ]),
      };
    }
  }

  if (coefficientFeatureIds.length !== manifestFeatureIds.length) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'FEATURE_SCHEMA_MISMATCH',
          path: '$.coefficients',
          message: 'Coefficient featureIds count does not match manifest features count',
        },
      ]),
    };
  }

  for (let i = 0; i < coefficientFeatureIds.length; i++) {
    if (coefficientFeatureIds[i] !== manifestFeatureIds[i]) {
      return {
        ok: false,
        issues: normalizeIssues([
          {
            code: 'FEATURE_SCHEMA_MISMATCH',
            path: '$.coefficients',
            message: 'Coefficient featureIds do not match manifest featureIds',
          },
        ]),
      };
    }
  }

  if (model.sport !== 'MLB') {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.model.sport',
          message: 'Model sport must be MLB',
        },
      ]),
    };
  }

  if (snap.sport !== 'MLB') {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.snapshot.sport',
          message: 'Snapshot sport must be MLB',
        },
      ]),
    };
  }

  if (manifest.sport !== 'MLB') {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.manifest.sport',
          message: 'Manifest sport must be MLB',
        },
      ]),
    };
  }

  if (manifest.target !== 'OFFICIAL_FINAL_GAME_WINNER') {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.manifest.target',
          message: 'Manifest target must be OFFICIAL_FINAL_GAME_WINNER',
        },
      ]),
    };
  }

  const combinedResultId = `${model.planId}::test-release-v1`;
  if (releaseValidation.value.resultId !== combinedResultId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.resultId',
          message: 'Combined resultId does not match planId::test-release-v1',
        },
      ]),
    };
  }

  const fitValidationResultId = `${model.planId}::fit-validation-v1`;
  if (fitValidation.resultId !== fitValidationResultId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.fitValidation.resultId',
          message: 'Fit-validation resultId does not match planId::fit-validation-v1',
        },
      ]),
    };
  }

  const validationEvaluationId = `${model.modelId}::validation-v1`;
  if (fitValidation.validation.evaluationId !== validationEvaluationId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.fitValidation.validation.evaluationId',
          message: 'Validation evaluationId does not match modelId::validation-v1',
        },
      ]),
    };
  }

  const testEvaluationIdValue = `${model.modelId}::test-v1`;
  if (testEvaluation.evaluationId !== testEvaluationIdValue) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.test.evaluationId',
          message: 'Test evaluationId does not match modelId::test-v1',
        },
      ]),
    };
  }

  const releaseId = `${model.modelId}::offline-release-candidate-v1`;
  if (releaseRecord.releaseId !== releaseId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.releaseId',
          message: 'Release releaseId does not match modelId::offline-release-candidate-v1',
        },
      ]),
    };
  }

  if (testEvaluation.modelId !== model.modelId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.test.modelId',
          message: 'Test modelId does not match model modelId',
        },
      ]),
    };
  }
  if (testEvaluation.planId !== model.planId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.test.planId',
          message: 'Test planId does not match model planId',
        },
      ]),
    };
  }
  if (testEvaluation.matrixId !== model.matrixId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.test.matrixId',
          message: 'Test matrixId does not match model matrixId',
        },
      ]),
    };
  }
  if (testEvaluation.configId !== model.configId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.test.configId',
          message: 'Test configId does not match model configId',
        },
      ]),
    };
  }

  if (releaseRecord.modelId !== model.modelId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.modelId',
          message: 'Release modelId does not match model modelId',
        },
      ]),
    };
  }
  if (releaseRecord.planId !== model.planId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.planId',
          message: 'Release planId does not match model planId',
        },
      ]),
    };
  }
  if (releaseRecord.matrixId !== model.matrixId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.matrixId',
          message: 'Release matrixId does not match model matrixId',
        },
      ]),
    };
  }
  if (releaseRecord.configId !== model.configId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.configId',
          message: 'Release configId does not match model configId',
        },
      ]),
    };
  }
  if (releaseRecord.manifestId !== model.manifestId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.manifestId',
          message: 'Release manifestId does not match model manifestId',
        },
      ]),
    };
  }
  if (releaseRecord.datasetId !== model.datasetId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.datasetId',
          message: 'Release datasetId does not match model datasetId',
        },
      ]),
    };
  }
  if (releaseRecord.algorithm !== model.algorithm) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.algorithm',
          message: 'Release algorithm does not match model algorithm',
        },
      ]),
    };
  }

  if (releaseRecord.validationEvaluationId !== fitValidation.validation.evaluationId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.validationEvaluationId',
          message: 'Release validationEvaluationId does not match validation evaluationId',
        },
      ]),
    };
  }

  if (releaseRecord.testEvaluationId !== testEvaluation.evaluationId) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: '$.releasedModelResult.release.testEvaluationId',
          message: 'Release testEvaluationId does not match test evaluationId',
        },
      ]),
    };
  }

  const game = snap.game;

  const extractionResult = extractMLBLeakageSafeFeatureVector(manifest, snap);
  if (!extractionResult.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'FEATURE_EXTRACTION_FAILED', path: '$.featureVector', message: 'Feature extraction failed' },
      ]),
    };
  }

  const vector = extractionResult.value;

  const vectorFeatureIds = vector.values.map((v) => v.featureId);
  if (vectorFeatureIds.length !== manifestFeatureIds.length) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'FEATURE_SCHEMA_MISMATCH',
          path: '$.featureVector',
          message: 'Extracted vector featureIds count does not match manifest',
        },
      ]),
    };
  }

  for (let i = 0; i < vectorFeatureIds.length; i++) {
    if (vectorFeatureIds[i] !== manifestFeatureIds[i]) {
      return {
        ok: false,
        issues: normalizeIssues([
          {
            code: 'FEATURE_SCHEMA_MISMATCH',
            path: '$.featureVector',
            message: 'Extracted vector featureIds do not match manifest order',
          },
        ]),
      };
    }
  }

  if (!Number.isFinite(model.intercept)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Model intercept is not finite' },
      ]),
    };
  }

  let score = model.intercept;

  for (let i = 0; i < modelFeatureIds.length; i++) {
    const featureId = modelFeatureIds[i];
    const extracted = vector.values[i];
    const coefficient = model.coefficients[i];

    if (!Number.isFinite(coefficient.valueCoefficient)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Value coefficient is not finite' },
        ]),
      };
    }

    if (!Number.isFinite(coefficient.missingIndicatorCoefficient)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Missing-indicator coefficient is not finite' },
        ]),
      };
    }

    if (!Number.isFinite(extracted.value)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Extracted feature value is not finite' },
        ]),
      };
    }

    const valueProduct = coefficient.valueCoefficient * extracted.value;
    if (!Number.isFinite(valueProduct)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Value-coefficient product is not finite' },
        ]),
      };
    }

    const missingProduct =
      coefficient.missingIndicatorCoefficient * (extracted.wasMissing ? 1 : 0);
    if (!Number.isFinite(missingProduct)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Missing-indicator product is not finite' },
        ]),
      };
    }

    score = score + valueProduct + missingProduct;
    if (!Number.isFinite(score)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Linear score is not finite' },
        ]),
      };
    }
  }

  let homeWinProbability: number;
  if (score >= 0) {
    const expNeg = Math.exp(-score);
    if (!Number.isFinite(expNeg)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Exponential intermediate is not finite' },
        ]),
      };
    }
    const denominator = 1 + expNeg;
    if (!Number.isFinite(denominator)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Sigmoid denominator is not finite' },
        ]),
      };
    }
    homeWinProbability = 1 / denominator;
  } else {
    const expPos = Math.exp(score);
    if (!Number.isFinite(expPos)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Exponential intermediate is not finite' },
        ]),
      };
    }
    const denominator = 1 + expPos;
    if (!Number.isFinite(denominator)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Sigmoid denominator is not finite' },
        ]),
      };
    }
    homeWinProbability = expPos / denominator;
  }

  if (!Number.isFinite(homeWinProbability)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Home probability is not finite' },
      ]),
    };
  }

  let awayWinProbability = 1 - homeWinProbability;
  if (!Number.isFinite(awayWinProbability)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NUMERICAL_FAILURE', path: '$.inference', message: 'Away probability is not finite' },
      ]),
    };
  }

  if (Object.is(homeWinProbability, -0)) {
    homeWinProbability = 0;
  }
  if (Object.is(awayWinProbability, -0)) {
    awayWinProbability = 0;
  }

  const predictedSide: MLBOfflinePregamePredictedSide =
    homeWinProbability >= 0.5 ? 'HOME' : 'AWAY';
  const predictedTeamId =
    predictedSide === 'HOME' ? game.homeTeamId : game.awayTeamId;

  const inference: MLBOfflinePregameInference = {
    contractVersion: MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    inferenceId: `${releaseRecord.releaseId}::${snap.snapshotId}::offline-pregame-inference-v1`,
    releaseId: releaseRecord.releaseId,
    modelId: model.modelId,
    planId: model.planId,
    matrixId: model.matrixId,
    configId: model.configId,
    manifestId: model.manifestId,
    snapshotId: snap.snapshotId,
    gameId: game.gameId,
    officialDate: game.officialDate,
    dataCutoffAt: snap.dataCutoffAt,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    decisionPolicy: MLB_OFFLINE_PREGAME_DECISION_POLICY,
    homeTeamId: game.homeTeamId,
    awayTeamId: game.awayTeamId,
    probabilities: { homeWinProbability, awayWinProbability },
    predictedSide,
    predictedTeamId,
  };

  const inferenceValidation = validateMLBOfflinePregameInference(inference);
  if (!inferenceValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'GENERATED_INFERENCE_INVALID', path: '$.inference', message: 'Generated inference failed validation' },
      ]),
    };
  }

  try {
    assertNoOddsContamination(inference);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ODDS_CONTAMINATION')) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'ODDS_CONTAMINATION', path: '$.inference', message: 'Odds contamination detected' },
        ]),
      };
    }
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'INVALID_JSON_VALUE', path: '$.inference', message: 'Uninspectable inference' },
      ]),
    };
  }

  return { ok: true, value: inference };
}