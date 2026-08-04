import { assertNoOddsContamination } from '../firewall/odds-contamination-guard';
import {
  type MLBOfflinePregameInference,
  validateMLBOfflinePregameInference,
} from './mlb-offline-pregame-inference-contract';

export const MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION =
  'mlb-offline-prediction-slate-v1' as const;

export const MLB_OFFLINE_PREDICTION_SLATE_ORDER_POLICY =
  'GAME_ID_ASC_SNAPSHOT_ID_ASC_INFERENCE_ID_ASC_V1' as const;

export type MLBOfflinePredictionSlateEntry = MLBOfflinePregameInference;

export type MLBOfflinePredictionSlate = Readonly<{
  contractVersion: 'mlb-offline-prediction-slate-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  slateId: string;
  releaseId: string;
  modelId: string;
  planId: string;
  matrixId: string;
  configId: string;
  manifestId: string;
  officialDate: string;
  orderPolicy: 'GAME_ID_ASC_SNAPSHOT_ID_ASC_INFERENCE_ID_ASC_V1';
  predictionCount: number;
  predictions: readonly MLBOfflinePredictionSlateEntry[];
}>;

export type MLBOfflinePredictionSlateIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'EMPTY_SLATE'
    | 'INFERENCE_INVALID'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'OFFICIAL_DATE_MISMATCH'
    | 'DUPLICATE_INFERENCE_ID'
    | 'DUPLICATE_GAME_ID'
    | 'ORDER_MISMATCH'
    | 'SLATE_ID_MISMATCH'
    | 'PREDICTION_COUNT_MISMATCH'
    | 'GENERATED_SLATE_INVALID'
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

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBOfflinePredictionSlateIssue[],
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
  issues: MLBOfflinePredictionSlateIssue[],
  issue: MLBOfflinePredictionSlateIssue,
): void {
  const exists = issues.some(
    (item) => item.path === issue.path && item.code === issue.code,
  );
  if (!exists) {
    issues.push(issue);
  }
}

function normalizeIssues(
  issues: MLBOfflinePredictionSlateIssue[],
): readonly MLBOfflinePredictionSlateIssue[] {
  const unique = new Map<string, MLBOfflinePredictionSlateIssue>();
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

  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1) {
    return false;
  }

  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
  if (isLeapYear) {
    daysInMonth[1] = 29;
  }

  return day <= daysInMonth[month - 1];
}

const KNOWN_SLATE_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'slateId',
  'releaseId',
  'modelId',
  'planId',
  'matrixId',
  'configId',
  'manifestId',
  'officialDate',
  'orderPolicy',
  'predictionCount',
  'predictions',
]);

const PROHIBITED_SLATE_FIELDS = new Set([
  'generatedAt',
  'createdAt',
  'updatedAt',
  'servedAt',
  'deploymentStatus',
  'providerName',
  'recommendationCount',
  'multiCount',
  'stakeCount',
  'gradingState',
  'oddsMetadata',
  'odds',
  'price',
  'line',
  'market',
  'edge',
  'value',
  'recommendation',
  'multi',
  'parlay',
  'stake',
  'grade',
  'feature',
  'missing',
  'coefficient',
  'intercept',
  'rawScore',
  'score',
  'metric',
  'label',
  'row',
]);

function validatePredictionCount(
  value: unknown,
  predictionsLength: number,
  path: string,
  issues: MLBOfflinePredictionSlateIssue[],
): void {
  if (typeof value !== 'number') {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'predictionCount must be a number',
    });
    return;
  }
  if (!Number.isSafeInteger(value)) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'predictionCount must be a safe integer',
    });
    return;
  }
  if (value < 0) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'predictionCount must be non-negative',
    });
    return;
  }
  if (Object.is(value, -0)) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'predictionCount must not be negative zero',
    });
    return;
  }
  if (value !== predictionsLength) {
    issues.push({
      code: 'PREDICTION_COUNT_MISMATCH',
      path,
      message: 'predictionCount must equal predictions.length',
    });
  }
}

function isCanonicalOrder(
  predictions: readonly MLBOfflinePredictionSlateEntry[],
): boolean {
  for (let i = 1; i < predictions.length; i++) {
    const prev = predictions[i - 1];
    const curr = predictions[i];
    if (prev.gameId > curr.gameId) return false;
    if (prev.gameId === curr.gameId) {
      if (prev.snapshotId > curr.snapshotId) return false;
      if (prev.snapshotId === curr.snapshotId) {
        if (prev.inferenceId > curr.inferenceId) return false;
      }
    }
  }
  return true;
}

function canonicalSort(
  predictions: MLBOfflinePredictionSlateEntry[],
): MLBOfflinePredictionSlateEntry[] {
  return predictions.slice().sort((a, b) => {
    if (a.gameId < b.gameId) return -1;
    if (a.gameId > b.gameId) return 1;
    if (a.snapshotId < b.snapshotId) return -1;
    if (a.snapshotId > b.snapshotId) return 1;
    if (a.inferenceId < b.inferenceId) return -1;
    if (a.inferenceId > b.inferenceId) return 1;
    return 0;
  });
}

function buildSlate(
  releaseId: string,
  officialDate: string,
  predictions: readonly MLBOfflinePredictionSlateEntry[],
): MLBOfflinePredictionSlate {
  const slateId = `${releaseId}::${officialDate}::${MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION}`;
  return Object.freeze({
    contractVersion: MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    slateId,
    releaseId,
    modelId: predictions[0].modelId,
    planId: predictions[0].planId,
    matrixId: predictions[0].matrixId,
    configId: predictions[0].configId,
    manifestId: predictions[0].manifestId,
    officialDate,
    orderPolicy: MLB_OFFLINE_PREDICTION_SLATE_ORDER_POLICY,
    predictionCount: predictions.length,
    predictions: Object.freeze(predictions.slice()) as readonly MLBOfflinePredictionSlateEntry[],
  });
}

export function validateMLBOfflinePredictionSlate(
  proposed: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflinePredictionSlate;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflinePredictionSlateIssue[];
    }> {
  const issues: MLBOfflinePredictionSlateIssue[] = [];

  if (!isPlainObject(proposed)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Slate must be a plain object' },
      ]),
    };
  }

  const root = proposed as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `$[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_SLATE_FIELDS.has(key)) {
      if (PROHIBITED_SLATE_FIELDS.has(key)) {
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
    if (KNOWN_SLATE_FIELDS.has(key)) {
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
    if (contractVersion !== MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.contractVersion',
        message: `contractVersion must be ${MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION}`,
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

  const slateIdResult = ownDataProperty(root, 'slateId', '$.slateId', issues);
  if (slateIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.slateId',
      message: 'slateId is required',
    });
  } else if (slateIdResult !== 'accessor') {
    const slateId = (slateIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(slateId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.slateId',
        message: 'slateId must be a valid identifier',
      });
    }
  }

  const releaseIdResult = ownDataProperty(root, 'releaseId', '$.releaseId', issues);
  if (releaseIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.releaseId',
      message: 'releaseId is required',
    });
  } else if (releaseIdResult !== 'accessor') {
    const releaseId = (releaseIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(releaseId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.releaseId',
        message: 'releaseId must be a valid identifier',
      });
    }
  }

  const modelIdResult = ownDataProperty(root, 'modelId', '$.modelId', issues);
  if (modelIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.modelId',
      message: 'modelId is required',
    });
  } else if (modelIdResult !== 'accessor') {
    const modelId = (modelIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(modelId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.modelId',
        message: 'modelId must be a valid identifier',
      });
    }
  }

  const planIdResult = ownDataProperty(root, 'planId', '$.planId', issues);
  if (planIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.planId',
      message: 'planId is required',
    });
  } else if (planIdResult !== 'accessor') {
    const planId = (planIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(planId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.planId',
        message: 'planId must be a valid identifier',
      });
    }
  }

  const matrixIdResult = ownDataProperty(root, 'matrixId', '$.matrixId', issues);
  if (matrixIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.matrixId',
      message: 'matrixId is required',
    });
  } else if (matrixIdResult !== 'accessor') {
    const matrixId = (matrixIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(matrixId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.matrixId',
        message: 'matrixId must be a valid identifier',
      });
    }
  }

  const configIdResult = ownDataProperty(root, 'configId', '$.configId', issues);
  if (configIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.configId',
      message: 'configId is required',
    });
  } else if (configIdResult !== 'accessor') {
    const configId = (configIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(configId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.configId',
        message: 'configId must be a valid identifier',
      });
    }
  }

  const manifestIdResult = ownDataProperty(root, 'manifestId', '$.manifestId', issues);
  if (manifestIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.manifestId',
      message: 'manifestId is required',
    });
  } else if (manifestIdResult !== 'accessor') {
    const manifestId = (manifestIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(manifestId)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.manifestId',
        message: 'manifestId must be a valid identifier',
      });
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
    if (
      typeof officialDate !== 'string' ||
      !isValidGregorianDate(officialDate)
    ) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.officialDate',
        message: 'officialDate must be a valid calendar date',
      });
    }
  }

  const orderPolicyResult = ownDataProperty(
    root,
    'orderPolicy',
    '$.orderPolicy',
    issues,
  );
  if (orderPolicyResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.orderPolicy',
      message: 'orderPolicy is required',
    });
  } else if (orderPolicyResult !== 'accessor') {
    const orderPolicy = (orderPolicyResult as { kind: 'data'; value: unknown }).value;
    if (orderPolicy !== MLB_OFFLINE_PREDICTION_SLATE_ORDER_POLICY) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.orderPolicy',
        message: `orderPolicy must be ${MLB_OFFLINE_PREDICTION_SLATE_ORDER_POLICY}`,
      });
    }
  }

  const predictionCountResult = ownDataProperty(
    root,
    'predictionCount',
    '$.predictionCount',
    issues,
  );
  if (predictionCountResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.predictionCount',
      message: 'predictionCount is required',
    });
  }

  const predictionsDescriptor = Object.getOwnPropertyDescriptor(root, 'predictions');
  if (!predictionsDescriptor) {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.predictions',
      message: 'predictions is required',
    });
  } else if (!isDataDescriptor(predictionsDescriptor)) {
    pushUniqueIssue(issues, {
      code: 'INVALID_JSON_VALUE',
      path: '$.predictions',
      message: 'Accessor property: predictions',
    });
  }

  let predictionsLength = 0;
  let predictionsArray: MLBOfflinePredictionSlateEntry[] | undefined;

  if (predictionsDescriptor && isDataDescriptor(predictionsDescriptor)) {
    const predictionsValue = predictionsDescriptor.value;
    if (!Array.isArray(predictionsValue)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_ARRAY',
        path: '$.predictions',
        message: 'predictions must be an array',
      });
    } else {
      const array = predictionsValue as unknown[];

      let sparse = false;
      for (let i = 0; i < array.length; i++) {
        if (!(i in array)) {
          sparse = true;
          break;
        }
      }
      if (sparse) {
        pushUniqueIssue(issues, {
          code: 'INVALID_ARRAY',
          path: '$.predictions',
          message: 'Sparse array',
        });
      }

      if (Object.getOwnPropertySymbols(array).length > 0) {
        pushUniqueIssue(issues, {
          code: 'UNKNOWN_FIELD',
          path: '$.predictions[symbol]',
          message: 'Array symbol property',
        });
      }

      const ownNames = Object.getOwnPropertyNames(array);
      for (const key of ownNames) {
        if (key !== 'length' && !/^\d+$/.test(key)) {
          const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '');
          if (PROHIBITED_SLATE_FIELDS.has(normalizedKey)) {
            pushUniqueIssue(issues, {
              code: 'PROHIBITED_CONCEPT',
              path: `$.predictions.${key}`,
              message: `Prohibited field: ${key}`,
            });
          } else {
            pushUniqueIssue(issues, {
              code: 'UNKNOWN_FIELD',
              path: `$.predictions.${key}`,
              message: `Unknown field: ${key}`,
            });
          }
        }
      }

      for (const key of ownNames) {
        if (/^\d+$/.test(key)) {
          const indexDescriptor = Object.getOwnPropertyDescriptor(array, key);
          if (indexDescriptor && !isDataDescriptor(indexDescriptor)) {
            pushUniqueIssue(issues, {
              code: 'INVALID_JSON_VALUE',
              path: `$.predictions[${key}]`,
              message: `Accessor property: ${key}`,
            });
          }
        }
      }

      if (!sparse && Object.getOwnPropertySymbols(array).length === 0) {
        const entries: MLBOfflinePredictionSlateEntry[] = [];
        for (let i = 0; i < array.length; i++) {
          const indexDescriptor = Object.getOwnPropertyDescriptor(array, i);
          if (!indexDescriptor || !isDataDescriptor(indexDescriptor)) {
            continue;
          }
          const entryResult = validateMLBOfflinePregameInference(
            indexDescriptor.value,
          );
          if (!entryResult.ok) {
            pushUniqueIssue(issues, {
              code: 'INFERENCE_INVALID',
              path: `$.predictions[${i}]`,
              message: 'Invalid inference',
            });
          } else {
            entries.push(entryResult.value);
          }
        }
        predictionsLength = array.length;
        predictionsArray = entries;
      }
    }
  }

  if (predictionCountResult !== 'missing' && predictionCountResult !== 'accessor') {
    const predictionCount = (predictionCountResult as { kind: 'data'; value: unknown }).value;
    validatePredictionCount(predictionCount, predictionsLength, '$.predictionCount', issues);
  }

  if (predictionsArray !== undefined && predictionsLength === 0) {
    pushUniqueIssue(issues, {
      code: 'EMPTY_SLATE',
      path: '$.predictions',
      message: 'predictions must contain at least one entry',
    });
  }

  if (predictionsArray !== undefined && predictionsArray.length > 0) {
    const first = predictionsArray[0];
    const releaseId = first.releaseId;
    const modelId = first.modelId;
    const planId = first.planId;
    const matrixId = first.matrixId;
    const configId = first.configId;
    const manifestId = first.manifestId;
    const officialDate = first.officialDate;

    for (let i = 1; i < predictionsArray.length; i++) {
      const entry = predictionsArray[i];
      if (entry.releaseId !== releaseId) {
        pushUniqueIssue(issues, {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: `$.predictions[${i}].releaseId`,
          message: 'releaseId mismatch',
        });
        break;
      }
      if (entry.modelId !== modelId) {
        pushUniqueIssue(issues, {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: `$.predictions[${i}].modelId`,
          message: 'modelId mismatch',
        });
        break;
      }
      if (entry.planId !== planId) {
        pushUniqueIssue(issues, {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: `$.predictions[${i}].planId`,
          message: 'planId mismatch',
        });
        break;
      }
      if (entry.matrixId !== matrixId) {
        pushUniqueIssue(issues, {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: `$.predictions[${i}].matrixId`,
          message: 'matrixId mismatch',
        });
        break;
      }
      if (entry.configId !== configId) {
        pushUniqueIssue(issues, {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: `$.predictions[${i}].configId`,
          message: 'configId mismatch',
        });
        break;
      }
      if (entry.manifestId !== manifestId) {
        pushUniqueIssue(issues, {
          code: 'SOURCE_IDENTITY_MISMATCH',
          path: `$.predictions[${i}].manifestId`,
          message: 'manifestId mismatch',
        });
        break;
      }
    }

    for (let i = 1; i < predictionsArray.length; i++) {
      if (predictionsArray[i].officialDate !== officialDate) {
        pushUniqueIssue(issues, {
          code: 'OFFICIAL_DATE_MISMATCH',
          path: '$.predictions',
          message: 'officialDate mismatch',
        });
        break;
      }
    }

    const inferenceIds = new Set<string>();
    const gameIds = new Set<string>();

    for (let i = 0; i < predictionsArray.length; i++) {
      const entry = predictionsArray[i];
      if (inferenceIds.has(entry.inferenceId)) {
        pushUniqueIssue(issues, {
          code: 'DUPLICATE_INFERENCE_ID',
          path: `$.predictions[${i}]`,
          message: `Duplicate inferenceId: ${entry.inferenceId}`,
        });
        break;
      }
      inferenceIds.add(entry.inferenceId);

      if (gameIds.has(entry.gameId)) {
        pushUniqueIssue(issues, {
          code: 'DUPLICATE_GAME_ID',
          path: `$.predictions[${i}]`,
          message: `Duplicate gameId: ${entry.gameId}`,
        });
        break;
      }
      gameIds.add(entry.gameId);
    }

    if (!isCanonicalOrder(predictionsArray)) {
      pushUniqueIssue(issues, {
        code: 'ORDER_MISMATCH',
        path: '$.predictions',
        message: 'Predictions must be in canonical order',
      });
    }
  }

  const releaseIdFromRoot =
    releaseIdResult !== 'missing' && releaseIdResult !== 'accessor'
      ? (releaseIdResult as { kind: 'data'; value: unknown }).value
      : null;
  const officialDateFromRoot =
    officialDateResult !== 'missing' && officialDateResult !== 'accessor'
      ? (officialDateResult as { kind: 'data'; value: unknown }).value
      : null;

  if (
    typeof releaseIdFromRoot === 'string' &&
    typeof officialDateFromRoot === 'string'
  ) {
    const expectedSlateId = `${releaseIdFromRoot}::${officialDateFromRoot}::${MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION}`;
    if (slateIdResult !== 'missing' && slateIdResult !== 'accessor') {
      const slateId = (slateIdResult as { kind: 'data'; value: unknown }).value;
      if (slateId !== expectedSlateId) {
        pushUniqueIssue(issues, {
          code: 'SLATE_ID_MISMATCH',
          path: '$.slateId',
          message: 'slateId does not match the deterministic formula',
        });
      }
    }
  }

  try {
    assertNoOddsContamination(proposed);
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

  return { ok: true, value: proposed as MLBOfflinePredictionSlate };
}

export function buildMLBOfflinePredictionSlate(
  inferences: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflinePredictionSlate;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflinePredictionSlateIssue[];
    }> {
  const issues: MLBOfflinePredictionSlateIssue[] = [];

  if (!Array.isArray(inferences)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'INVALID_ARRAY', path: '$.inferences', message: 'Input must be an array' },
      ]),
    };
  }

  const inputArray = inferences as unknown[];

  let sparse = false;
  for (let i = 0; i < inputArray.length; i++) {
    if (!(i in inputArray)) {
      sparse = true;
      break;
    }
  }
  if (sparse) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'INVALID_ARRAY', path: '$.inferences', message: 'Sparse array' },
      ]),
    };
  }

  if (Object.getOwnPropertySymbols(inputArray).length > 0) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'UNKNOWN_FIELD', path: '$.inferences[symbol]', message: 'Array symbol property' },
      ]),
    };
  }

  const ownNames = Object.getOwnPropertyNames(inputArray);
  for (const key of ownNames) {
    if (key !== 'length' && !/^\d+$/.test(key)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (PROHIBITED_SLATE_FIELDS.has(normalizedKey)) {
        return {
          ok: false,
          issues: normalizeIssues([
            { code: 'PROHIBITED_CONCEPT', path: `$.inferences.${key}`, message: `Prohibited field: ${key}` },
          ]),
        };
      }
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'UNKNOWN_FIELD', path: `$.inferences.${key}`, message: `Unknown field: ${key}` },
        ]),
      };
    }
  }

  for (const key of ownNames) {
    if (/^\d+$/.test(key)) {
      const indexDescriptor = Object.getOwnPropertyDescriptor(inputArray, key);
      if (indexDescriptor && !isDataDescriptor(indexDescriptor)) {
        return {
          ok: false,
          issues: normalizeIssues([
            { code: 'INVALID_JSON_VALUE', path: `$.inferences[${key}]`, message: `Accessor property: ${key}` },
          ]),
        };
      }
    }
  }

  if (inputArray.length === 0) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'EMPTY_SLATE', path: '$.inferences', message: 'Input array must not be empty' },
      ]),
    };
  }

  const validated: MLBOfflinePredictionSlateEntry[] = [];

  for (let i = 0; i < inputArray.length; i++) {
    const indexDescriptor = Object.getOwnPropertyDescriptor(inputArray, i);
    if (!indexDescriptor || !isDataDescriptor(indexDescriptor)) {
      continue;
    }

    const inferenceValidation = validateMLBOfflinePregameInference(
      indexDescriptor.value,
    );
    if (!inferenceValidation.ok) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'INFERENCE_INVALID', path: `$.inferences[${i}]`, message: 'Invalid inference' },
        ]),
      };
    }

    validated.push(inferenceValidation.value);

    if (i === 0) {
      continue;
    }

    const first = validated[0];
    const entry = inferenceValidation.value;
    if (entry.releaseId !== first.releaseId) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'SOURCE_IDENTITY_MISMATCH', path: `$.inferences[${i}].releaseId`, message: 'releaseId mismatch' },
        ]),
      };
    }
    if (entry.modelId !== first.modelId) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'SOURCE_IDENTITY_MISMATCH', path: `$.inferences[${i}].modelId`, message: 'modelId mismatch' },
        ]),
      };
    }
    if (entry.planId !== first.planId) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'SOURCE_IDENTITY_MISMATCH', path: `$.inferences[${i}].planId`, message: 'planId mismatch' },
        ]),
      };
    }
    if (entry.matrixId !== first.matrixId) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'SOURCE_IDENTITY_MISMATCH', path: `$.inferences[${i}].matrixId`, message: 'matrixId mismatch' },
        ]),
      };
    }
    if (entry.configId !== first.configId) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'SOURCE_IDENTITY_MISMATCH', path: `$.inferences[${i}].configId`, message: 'configId mismatch' },
        ]),
      };
    }
    if (entry.manifestId !== first.manifestId) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'SOURCE_IDENTITY_MISMATCH', path: `$.inferences[${i}].manifestId`, message: 'manifestId mismatch' },
        ]),
      };
    }
    if (entry.officialDate !== first.officialDate) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'OFFICIAL_DATE_MISMATCH', path: '$.inferences', message: 'officialDate mismatch' },
        ]),
      };
    }
  }

  const inferenceIds = new Set<string>();
  const gameIds = new Set<string>();

  for (let i = 0; i < validated.length; i++) {
    const entry = validated[i];
    if (inferenceIds.has(entry.inferenceId)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'DUPLICATE_INFERENCE_ID', path: `$.inferences[${i}]`, message: `Duplicate inferenceId: ${entry.inferenceId}` },
        ]),
      };
    }
    inferenceIds.add(entry.inferenceId);

    if (gameIds.has(entry.gameId)) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'DUPLICATE_GAME_ID', path: `$.inferences[${i}]`, message: `Duplicate gameId: ${entry.gameId}` },
        ]),
      };
    }
    gameIds.add(entry.gameId);
  }

  const sorted = canonicalSort(validated);
  const slate = buildSlate(validated[0].releaseId, validated[0].officialDate, sorted);

  const slateValidation = validateMLBOfflinePredictionSlate(slate);
  if (!slateValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'GENERATED_SLATE_INVALID', path: '$', message: 'Generated slate failed validation' },
      ]),
    };
  }

  try {
    assertNoOddsContamination(slate);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ODDS_CONTAMINATION')) {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'ODDS_CONTAMINATION', path: '$', message: 'Odds contamination detected' },
        ]),
      };
    }
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'INVALID_JSON_VALUE', path: '$', message: 'Uninspectable accessor property' },
      ]),
    };
  }

  return { ok: true, value: slate };
}
