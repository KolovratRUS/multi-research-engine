import { assertNoOddsContamination } from '../firewall/odds-contamination-guard';
import {
  type MLBOfflinePredictionSlate,
  validateMLBOfflinePredictionSlate,
} from './mlb-offline-prediction-slate-contract';

export const MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_SET_CONTRACT_VERSION =
  'mlb-offline-single-pick-recommendation-set-v1' as const;

export const MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_POLICY =
  'ALL_VALIDATED_PREDICTIONS_V1' as const;

export const MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_ORDER_POLICY =
  'MODEL_CONFIDENCE_DESC_GAME_ID_ASC_SNAPSHOT_ID_ASC_INFERENCE_ID_ASC_V1' as const;

export type MLBOfflineSinglePickRecommendation = Readonly<{
  recommendationId: string;
  inferenceId: string;
  snapshotId: string;
  gameId: string;
  officialDate: string;
  dataCutoffAt: string;
  homeTeamId: string;
  awayTeamId: string;
  recommendedSide: 'HOME' | 'AWAY';
  recommendedTeamId: string;
  probabilities: Readonly<{
    homeWinProbability: number;
    awayWinProbability: number;
  }>;
  modelConfidence: number;
  modelUncertainty: number;
}>;

export type MLBOfflineSinglePickRecommendationSet = Readonly<{
  contractVersion: 'mlb-offline-single-pick-recommendation-set-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  recommendationSetId: string;
  slateId: string;
  releaseId: string;
  modelId: string;
  planId: string;
  matrixId: string;
  configId: string;
  manifestId: string;
  algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1';
  decisionPolicy: 'HOME_AT_OR_ABOVE_0_5_V1';
  officialDate: string;
  recommendationPolicy: 'ALL_VALIDATED_PREDICTIONS_V1';
  orderPolicy: 'MODEL_CONFIDENCE_DESC_GAME_ID_ASC_SNAPSHOT_ID_ASC_INFERENCE_ID_ASC_V1';
  recommendationCount: number;
  recommendations: readonly MLBOfflineSinglePickRecommendation[];
}>;

export type MLBOfflineSinglePickRecommendationSetIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'EMPTY_RECOMMENDATION_SET'
    | 'RECOMMENDATION_INVALID'
    | 'SOURCE_SLATE_INVALID'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'DUPLICATE_RECOMMENDATION_ID'
    | 'DUPLICATE_GAME_ID'
    | 'ORDER_MISMATCH'
    | 'RECOMMENDATION_ID_MISMATCH'
    | 'RECOMMENDATION_SET_ID_MISMATCH'
    | 'RECOMMENDATION_COUNT_MISMATCH'
    | 'PROBABILITY_MISMATCH'
    | 'CONFIDENCE_MISMATCH'
    | 'UNCERTAINTY_MISMATCH'
    | 'SELECTION_MISMATCH'
    | 'GENERATED_RECOMMENDATION_SET_INVALID'
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
  issues: MLBOfflineSinglePickRecommendationSetIssue[],
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
  issues: MLBOfflineSinglePickRecommendationSetIssue[],
  issue: MLBOfflineSinglePickRecommendationSetIssue,
): void {
  const exists = issues.some(
    (item) => item.path === issue.path && item.code === issue.code,
  );
  if (!exists) {
    issues.push(issue);
  }
}

function normalizeIssues(
  issues: MLBOfflineSinglePickRecommendationSetIssue[],
): readonly MLBOfflineSinglePickRecommendationSetIssue[] {
  const unique = new Map<string, MLBOfflineSinglePickRecommendationSetIssue>();
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

function isValidRfc3339Timestamp(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    value === value.trim()
  );
}

const KNOWN_SET_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'recommendationSetId',
  'slateId',
  'releaseId',
  'modelId',
  'planId',
  'matrixId',
  'configId',
  'manifestId',
  'algorithm',
  'decisionPolicy',
  'officialDate',
  'recommendationPolicy',
  'orderPolicy',
  'recommendationCount',
  'recommendations',
]);

const PROHIBITED_SET_FIELDS = new Set([
  'generatedAt',
  'createdAt',
  'updatedAt',
  'servedAt',
  'deploymentStatus',
  'providerName',
  'recommendationThreshold',
  'stakePolicy',
  'multiPolicy',
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
  'metric',
  'label',
  'row',
]);

const KNOWN_RECOMMENDATION_FIELDS = new Set([
  'recommendationId',
  'inferenceId',
  'snapshotId',
  'gameId',
  'officialDate',
  'dataCutoffAt',
  'homeTeamId',
  'awayTeamId',
  'recommendedSide',
  'recommendedTeamId',
  'probabilities',
  'modelConfidence',
  'modelUncertainty',
]);

const PROHIBITED_RECOMMENDATION_FIELDS = new Set([
  'sportsbook',
  'odds',
  'price',
  'line',
  'market',
  'edge',
  'value',
  'payout',
  'multi',
  'parlay',
  'stake',
  'grade',
  'feature',
  'missing',
  'coefficient',
  'intercept',
  'rawScore',
  'metric',
  'label',
  'row',
]);

const KNOWN_PROBABILITY_FIELDS = new Set([
  'homeWinProbability',
  'awayWinProbability',
]);

function validateRecommendationCount(
  value: unknown,
  recommendationsLength: number,
  path: string,
  issues: MLBOfflineSinglePickRecommendationSetIssue[],
): void {
  if (typeof value !== 'number') {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'recommendationCount must be a number',
    });
    return;
  }
  if (!Number.isSafeInteger(value)) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'recommendationCount must be a safe integer',
    });
    return;
  }
  if (value < 0) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'recommendationCount must be non-negative',
    });
    return;
  }
  if (Object.is(value, -0)) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'recommendationCount must not be negative zero',
    });
    return;
  }
  if (value !== recommendationsLength) {
    issues.push({
      code: 'RECOMMENDATION_COUNT_MISMATCH',
      path,
      message: 'recommendationCount must equal recommendations.length',
    });
  }
}

function canonicalSort(
  recommendations: MLBOfflineSinglePickRecommendation[],
): MLBOfflineSinglePickRecommendation[] {
  return recommendations.slice().sort((a, b) => {
    if (a.modelConfidence > b.modelConfidence) return -1;
    if (a.modelConfidence < b.modelConfidence) return 1;
    if (a.gameId < b.gameId) return -1;
    if (a.gameId > b.gameId) return 1;
    if (a.snapshotId < b.snapshotId) return -1;
    if (a.snapshotId > b.snapshotId) return 1;
    if (a.inferenceId < b.inferenceId) return -1;
    if (a.inferenceId > b.inferenceId) return 1;
    return 0;
  });
}

function buildRecommendation(
  prediction: MLBOfflinePredictionSlate['predictions'][number],
): MLBOfflineSinglePickRecommendation {
  const recommendationId =
    prediction.inferenceId + '::offline-single-pick-recommendation-v1';

  let modelConfidence: number;
  let modelUncertainty: number;
  if (prediction.predictedSide === 'HOME') {
    modelConfidence = prediction.probabilities.homeWinProbability;
    modelUncertainty = prediction.probabilities.awayWinProbability;
  } else {
    modelConfidence = prediction.probabilities.awayWinProbability;
    modelUncertainty = prediction.probabilities.homeWinProbability;
  }

  return Object.freeze({
    recommendationId,
    inferenceId: prediction.inferenceId,
    snapshotId: prediction.snapshotId,
    gameId: prediction.gameId,
    officialDate: prediction.officialDate,
    dataCutoffAt: prediction.dataCutoffAt,
    homeTeamId: prediction.homeTeamId,
    awayTeamId: prediction.awayTeamId,
    recommendedSide: prediction.predictedSide,
    recommendedTeamId: prediction.predictedTeamId,
    probabilities: Object.freeze({
      homeWinProbability: prediction.probabilities.homeWinProbability,
      awayWinProbability: prediction.probabilities.awayWinProbability,
    }),
    modelConfidence,
    modelUncertainty,
  });
}

function buildRoot(
  slate: MLBOfflinePredictionSlate,
  recommendations: MLBOfflineSinglePickRecommendation[],
): MLBOfflineSinglePickRecommendationSet {
  const recommendationSetId =
    slate.slateId + '::offline-single-pick-recommendation-set-v1';

  return Object.freeze({
    contractVersion: MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_SET_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    recommendationSetId,
    slateId: slate.slateId,
    releaseId: slate.releaseId,
    modelId: slate.modelId,
    planId: slate.planId,
    matrixId: slate.matrixId,
    configId: slate.configId,
    manifestId: slate.manifestId,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    decisionPolicy: 'HOME_AT_OR_ABOVE_0_5_V1',
    officialDate: slate.officialDate,
    recommendationPolicy: MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_POLICY,
    orderPolicy: MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_ORDER_POLICY,
    recommendationCount: recommendations.length,
    recommendations: Object.freeze(recommendations) as readonly MLBOfflineSinglePickRecommendation[],
  });
}

function validateRecommendation(
  value: unknown,
  index: number,
  setOfficialDate: string,
  issues: MLBOfflineSinglePickRecommendationSetIssue[],
): void {
  const prefix = `$.recommendations[${index}]`;

  if (!isPlainObject(value)) {
    issues.push({
      code: 'NOT_PLAIN_OBJECT',
      path: `${prefix}`,
      message: 'Recommendation must be a plain object',
    });
    return;
  }

  const root = value as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(root)) {
    issues.push({
      code: 'UNKNOWN_FIELD',
      path: `${prefix}[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_RECOMMENDATION_FIELDS.has(key)) {
      if (PROHIBITED_RECOMMENDATION_FIELDS.has(key)) {
        issues.push({
          code: 'PROHIBITED_CONCEPT',
          path: `${prefix}.${key}`,
          message: `Prohibited field: ${key}`,
        });
      } else {
        issues.push({
          code: 'UNKNOWN_FIELD',
          path: `${prefix}.${key}`,
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
        path: `${prefix}.${key}`,
        message: `Accessor property: ${key}`,
      });
    }
  }

  const recommendationIdResult = ownDataProperty(
    root,
    'recommendationId',
    `${prefix}.recommendationId`,
    issues,
  );
  if (recommendationIdResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.recommendationId`,
      message: 'recommendationId is required',
    });
  } else if (recommendationIdResult !== 'accessor') {
    const recommendationId = (recommendationIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(recommendationId)) {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.recommendationId`,
        message: 'recommendationId must be a valid identifier',
      });
    }
  }

  const inferenceIdResult = ownDataProperty(
    root,
    'inferenceId',
    `${prefix}.inferenceId`,
    issues,
  );
  if (inferenceIdResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.inferenceId`,
      message: 'inferenceId is required',
    });
  } else if (inferenceIdResult !== 'accessor') {
    const inferenceId = (inferenceIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(inferenceId)) {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.inferenceId`,
        message: 'inferenceId must be a valid identifier',
      });
    }
  }

  const snapshotIdResult = ownDataProperty(
    root,
    'snapshotId',
    `${prefix}.snapshotId`,
    issues,
  );
  if (snapshotIdResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.snapshotId`,
      message: 'snapshotId is required',
    });
  } else if (snapshotIdResult !== 'accessor') {
    const snapshotId = (snapshotIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(snapshotId)) {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.snapshotId`,
        message: 'snapshotId must be a valid identifier',
      });
    }
  }

  const gameIdResult = ownDataProperty(
    root,
    'gameId',
    `${prefix}.gameId`,
    issues,
  );
  if (gameIdResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.gameId`,
      message: 'gameId is required',
    });
  } else if (gameIdResult !== 'accessor') {
    const gameId = (gameIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(gameId)) {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.gameId`,
        message: 'gameId must be a valid identifier',
      });
    }
  }

  const officialDateResult = ownDataProperty(
    root,
    'officialDate',
    `${prefix}.officialDate`,
    issues,
  );
  if (officialDateResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.officialDate`,
      message: 'officialDate is required',
    });
  } else if (officialDateResult !== 'accessor') {
    const officialDate = (officialDateResult as { kind: 'data'; value: unknown }).value;
    if (typeof officialDate !== 'string' || !isValidGregorianDate(officialDate)) {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.officialDate`,
        message: 'officialDate must be a valid calendar date',
      });
    }
  }

  const dataCutoffAtResult = ownDataProperty(
    root,
    'dataCutoffAt',
    `${prefix}.dataCutoffAt`,
    issues,
  );
  if (dataCutoffAtResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.dataCutoffAt`,
      message: 'dataCutoffAt is required',
    });
  } else if (dataCutoffAtResult !== 'accessor') {
    const dataCutoffAt = (dataCutoffAtResult as { kind: 'data'; value: unknown }).value;
    if (typeof dataCutoffAt !== 'string' || !isValidRfc3339Timestamp(dataCutoffAt)) {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.dataCutoffAt`,
        message: 'dataCutoffAt must be a valid timestamp',
      });
    }
  }

  const homeTeamIdResult = ownDataProperty(
    root,
    'homeTeamId',
    `${prefix}.homeTeamId`,
    issues,
  );
  if (homeTeamIdResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.homeTeamId`,
      message: 'homeTeamId is required',
    });
  } else if (homeTeamIdResult !== 'accessor') {
    const homeTeamId = (homeTeamIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(homeTeamId)) {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.homeTeamId`,
        message: 'homeTeamId must be a valid identifier',
      });
    }
  }

  const awayTeamIdResult = ownDataProperty(
    root,
    'awayTeamId',
    `${prefix}.awayTeamId`,
    issues,
  );
  if (awayTeamIdResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.awayTeamId`,
      message: 'awayTeamId is required',
    });
  } else if (awayTeamIdResult !== 'accessor') {
    const awayTeamId = (awayTeamIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(awayTeamId)) {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.awayTeamId`,
        message: 'awayTeamId must be a valid identifier',
      });
    }
  }

  const recommendedSideResult = ownDataProperty(
    root,
    'recommendedSide',
    `${prefix}.recommendedSide`,
    issues,
  );
  let recommendedSide: 'HOME' | 'AWAY' | null = null;
  if (recommendedSideResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.recommendedSide`,
      message: 'recommendedSide is required',
    });
  } else if (recommendedSideResult !== 'accessor') {
    const side = (recommendedSideResult as { kind: 'data'; value: unknown }).value;
    if (side !== 'HOME' && side !== 'AWAY') {
      issues.push({
        code: 'INVALID_LITERAL',
        path: `${prefix}.recommendedSide`,
        message: 'recommendedSide must be HOME or AWAY',
      });
    } else {
      recommendedSide = side;
    }
  }

  const recommendedTeamIdResult = ownDataProperty(
    root,
    'recommendedTeamId',
    `${prefix}.recommendedTeamId`,
    issues,
  );
  if (recommendedTeamIdResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.recommendedTeamId`,
      message: 'recommendedTeamId is required',
    });
  } else if (recommendedTeamIdResult !== 'accessor') {
    const recommendedTeamId = (recommendedTeamIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(recommendedTeamId)) {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.recommendedTeamId`,
        message: 'recommendedTeamId must be a valid identifier',
      });
    }
  }

  const probabilitiesResult = ownDataProperty(
    root,
    'probabilities',
    `${prefix}.probabilities`,
    issues,
  );
  let homeWinProbability: number | null = null;
  let awayWinProbability: number | null = null;
  let probabilitiesComplementValid = false;

  if (probabilitiesResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.probabilities`,
      message: 'probabilities is required',
    });
  } else if (probabilitiesResult !== 'accessor') {
    const probabilitiesValue = (probabilitiesResult as { kind: 'data'; value: unknown }).value;
    if (!isPlainObject(probabilitiesValue)) {
      issues.push({
        code: 'NOT_PLAIN_OBJECT',
        path: `${prefix}.probabilities`,
        message: 'probabilities must be a plain object',
      });
    } else {
      const probabilitiesRoot = probabilitiesValue as Record<string, unknown>;

      for (const symbol of Object.getOwnPropertySymbols(probabilitiesRoot)) {
        issues.push({
          code: 'UNKNOWN_FIELD',
          path: `${prefix}.probabilities[${String(symbol)}]`,
          message: 'Unknown symbol property',
        });
      }

      for (const key of Object.getOwnPropertyNames(probabilitiesRoot)) {
        if (!KNOWN_PROBABILITY_FIELDS.has(key)) {
          if (PROHIBITED_RECOMMENDATION_FIELDS.has(key)) {
            issues.push({
              code: 'PROHIBITED_CONCEPT',
              path: `${prefix}.probabilities.${key}`,
              message: `Prohibited field: ${key}`,
            });
          } else {
            issues.push({
              code: 'UNKNOWN_FIELD',
              path: `${prefix}.probabilities.${key}`,
              message: `Unknown field: ${key}`,
            });
          }
        }
      }

      for (const key of Object.getOwnPropertyNames(probabilitiesRoot)) {
        const descriptor = Object.getOwnPropertyDescriptor(probabilitiesRoot, key);
        if (descriptor && !isDataDescriptor(descriptor)) {
          issues.push({
            code: 'INVALID_JSON_VALUE',
            path: `${prefix}.probabilities.${key}`,
            message: `Accessor property: ${key}`,
          });
        }
      }

      const homeResult = ownDataProperty(
        probabilitiesRoot,
        'homeWinProbability',
        `${prefix}.probabilities.homeWinProbability`,
        issues,
      );
      if (homeResult === 'missing') {
        issues.push({
          code: 'MISSING_FIELD',
          path: `${prefix}.probabilities.homeWinProbability`,
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
            path: `${prefix}.probabilities.homeWinProbability`,
            message: 'homeWinProbability must be a finite number in [0, 1]',
          });
        } else {
          homeWinProbability = homeValue;
        }
      }

      const awayResult = ownDataProperty(
        probabilitiesRoot,
        'awayWinProbability',
        `${prefix}.probabilities.awayWinProbability`,
        issues,
      );
      if (awayResult === 'missing') {
        issues.push({
          code: 'MISSING_FIELD',
          path: `${prefix}.probabilities.awayWinProbability`,
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
            path: `${prefix}.probabilities.awayWinProbability`,
            message: 'awayWinProbability must be a finite number in [0, 1]',
          });
        } else {
          awayWinProbability = awayValue;
        }
      }

      if (
        homeWinProbability !== null &&
        awayWinProbability !== null &&
        awayWinProbability !== 1 - homeWinProbability
      ) {
        issues.push({
          code: 'PROBABILITY_MISMATCH',
          path: `${prefix}.probabilities`,
          message: 'awayWinProbability must equal 1 - homeWinProbability',
        });
      } else if (
        homeWinProbability !== null &&
        awayWinProbability !== null &&
        awayWinProbability === 1 - homeWinProbability
      ) {
        probabilitiesComplementValid = true;
      }
    }
  }

  const modelConfidenceResult = ownDataProperty(
    root,
    'modelConfidence',
    `${prefix}.modelConfidence`,
    issues,
  );
  let modelConfidence: number | null = null;
  if (modelConfidenceResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.modelConfidence`,
      message: 'modelConfidence is required',
    });
  } else if (modelConfidenceResult !== 'accessor') {
    const confidence = (modelConfidenceResult as { kind: 'data'; value: unknown }).value;
    if (
      typeof confidence !== 'number' ||
      !Number.isFinite(confidence) ||
      confidence < 0 ||
      confidence > 1 ||
      Object.is(confidence, -0)
    ) {
      issues.push({
        code: 'INVALID_NUMBER',
        path: `${prefix}.modelConfidence`,
        message: 'modelConfidence must be a finite number in [0, 1]',
      });
    } else {
      modelConfidence = confidence;
    }
  }

  const modelUncertaintyResult = ownDataProperty(
    root,
    'modelUncertainty',
    `${prefix}.modelUncertainty`,
    issues,
  );
  let modelUncertainty: number | null = null;
  if (modelUncertaintyResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.modelUncertainty`,
      message: 'modelUncertainty is required',
    });
  } else if (modelUncertaintyResult !== 'accessor') {
    const uncertainty = (modelUncertaintyResult as { kind: 'data'; value: unknown }).value;
    if (
      typeof uncertainty !== 'number' ||
      !Number.isFinite(uncertainty) ||
      uncertainty < 0 ||
      uncertainty > 1 ||
      Object.is(uncertainty, -0)
    ) {
      issues.push({
        code: 'INVALID_NUMBER',
        path: `${prefix}.modelUncertainty`,
        message: 'modelUncertainty must be a finite number in [0, 1]',
      });
    } else {
      modelUncertainty = uncertainty;
    }
  }

  if (
    homeWinProbability !== null &&
    awayWinProbability !== null &&
    modelConfidence !== null &&
    modelUncertainty !== null &&
    recommendedSide !== null &&
    probabilitiesComplementValid &&
    homeTeamIdResult !== 'missing' &&
    homeTeamIdResult !== 'accessor' &&
    awayTeamIdResult !== 'missing' &&
    awayTeamIdResult !== 'accessor' &&
    recommendedTeamIdResult !== 'missing' &&
    recommendedTeamIdResult !== 'accessor'
  ) {
    const homeTeamId = (homeTeamIdResult as { kind: 'data'; value: unknown }).value as string;
    const awayTeamId = (awayTeamIdResult as { kind: 'data'; value: unknown }).value as string;
    const recommendedTeamId = (recommendedTeamIdResult as { kind: 'data'; value: unknown }).value as string;

    if (recommendedSide === 'HOME') {
      if (modelConfidence !== homeWinProbability) {
        issues.push({
          code: 'CONFIDENCE_MISMATCH',
          path: `${prefix}.modelConfidence`,
          message: 'modelConfidence must equal homeWinProbability when recommendedSide is HOME',
        });
      }
      if (modelUncertainty !== awayWinProbability) {
        issues.push({
          code: 'UNCERTAINTY_MISMATCH',
          path: `${prefix}.modelUncertainty`,
          message: 'modelUncertainty must equal awayWinProbability when recommendedSide is HOME',
        });
      }
      if (recommendedTeamId !== homeTeamId) {
        issues.push({
          code: 'SELECTION_MISMATCH',
          path: `${prefix}.recommendedTeamId`,
          message: 'recommendedTeamId must equal homeTeamId when recommendedSide is HOME',
        });
      }
    } else {
      if (modelConfidence !== awayWinProbability) {
        issues.push({
          code: 'CONFIDENCE_MISMATCH',
          path: `${prefix}.modelConfidence`,
          message: 'modelConfidence must equal awayWinProbability when recommendedSide is AWAY',
        });
      }
      if (modelUncertainty !== homeWinProbability) {
        issues.push({
          code: 'UNCERTAINTY_MISMATCH',
          path: `${prefix}.modelUncertainty`,
          message: 'modelUncertainty must equal homeWinProbability when recommendedSide is AWAY',
        });
      }
      if (recommendedTeamId !== awayTeamId) {
        issues.push({
          code: 'SELECTION_MISMATCH',
          path: `${prefix}.recommendedTeamId`,
          message: 'recommendedTeamId must equal awayTeamId when recommendedSide is AWAY',
        });
      }
    }
  }

  if (officialDateResult !== 'missing' && officialDateResult !== 'accessor') {
    const officialDate = (officialDateResult as { kind: 'data'; value: unknown }).value as string;
    if (officialDate !== setOfficialDate) {
      issues.push({
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: `${prefix}.officialDate`,
        message: 'recommendation officialDate must equal the set officialDate',
      });
    }
  }

  const recommendationIdFromData =
    recommendationIdResult !== 'missing' && recommendationIdResult !== 'accessor'
      ? (recommendationIdResult as { kind: 'data'; value: unknown }).value
      : null;
  const inferenceIdFromData =
    inferenceIdResult !== 'missing' && inferenceIdResult !== 'accessor'
      ? (inferenceIdResult as { kind: 'data'; value: unknown }).value
      : null;

  if (
    typeof recommendationIdFromData === 'string' &&
    typeof inferenceIdFromData === 'string' &&
    recommendationIdFromData !==
      inferenceIdFromData + '::offline-single-pick-recommendation-v1'
  ) {
    issues.push({
      code: 'RECOMMENDATION_ID_MISMATCH',
      path: `${prefix}.recommendationId`,
      message: 'recommendationId must equal inferenceId::offline-single-pick-recommendation-v1',
    });
  }
}

export function validateMLBOfflineSinglePickRecommendationSet(
  proposed: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineSinglePickRecommendationSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineSinglePickRecommendationSetIssue[];
    }> {
  const issues: MLBOfflineSinglePickRecommendationSetIssue[] = [];

  if (!isPlainObject(proposed)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Recommendation set must be a plain object' },
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
    if (!KNOWN_SET_FIELDS.has(key)) {
      if (PROHIBITED_SET_FIELDS.has(key)) {
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
    if (KNOWN_SET_FIELDS.has(key)) {
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
    if (contractVersion !== MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_SET_CONTRACT_VERSION) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.contractVersion',
        message: `contractVersion must be ${MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_SET_CONTRACT_VERSION}`,
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

  const recommendationSetIdResult = ownDataProperty(
    root,
    'recommendationSetId',
    '$.recommendationSetId',
    issues,
  );
  if (recommendationSetIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.recommendationSetId',
      message: 'recommendationSetId is required',
    });
  } else if (recommendationSetIdResult !== 'accessor') {
    const recommendationSetId = (recommendationSetIdResult as { kind: 'data'; value: unknown }).value;
    if (!isStrictNonEmptyTrimmedString(recommendationSetId)) {
      issues.push({
        code: 'INVALID_STRING',
        path: '$.recommendationSetId',
        message: 'recommendationSetId must be a valid identifier',
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
      issues.push({
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
      issues.push({
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
      issues.push({
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
      issues.push({
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
      issues.push({
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
      issues.push({
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
      issues.push({
        code: 'INVALID_STRING',
        path: '$.manifestId',
        message: 'manifestId must be a valid identifier',
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
      issues.push({
        code: 'INVALID_STRING',
        path: '$.officialDate',
        message: 'officialDate must be a valid calendar date',
      });
    }
  }

  const recommendationPolicyResult = ownDataProperty(
    root,
    'recommendationPolicy',
    '$.recommendationPolicy',
    issues,
  );
  if (recommendationPolicyResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.recommendationPolicy',
      message: 'recommendationPolicy is required',
    });
  } else if (recommendationPolicyResult !== 'accessor') {
    const recommendationPolicy = (recommendationPolicyResult as { kind: 'data'; value: unknown }).value;
    if (recommendationPolicy !== MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_POLICY) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.recommendationPolicy',
        message: `recommendationPolicy must be ${MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_POLICY}`,
      });
    }
  }

  const orderPolicyResult = ownDataProperty(root, 'orderPolicy', '$.orderPolicy', issues);
  if (orderPolicyResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.orderPolicy',
      message: 'orderPolicy is required',
    });
  } else if (orderPolicyResult !== 'accessor') {
    const orderPolicy = (orderPolicyResult as { kind: 'data'; value: unknown }).value;
    if (orderPolicy !== MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_ORDER_POLICY) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.orderPolicy',
        message: `orderPolicy must be ${MLB_OFFLINE_SINGLE_PICK_RECOMMENDATION_ORDER_POLICY}`,
      });
    }
  }

  const recommendationCountResult = ownDataProperty(
    root,
    'recommendationCount',
    '$.recommendationCount',
    issues,
  );
  if (recommendationCountResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.recommendationCount',
      message: 'recommendationCount is required',
    });
  }

  const recommendationsDescriptor = Object.getOwnPropertyDescriptor(root, 'recommendations');
  if (!recommendationsDescriptor) {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.recommendations',
      message: 'recommendations is required',
    });
  } else if (!isDataDescriptor(recommendationsDescriptor)) {
    pushUniqueIssue(issues, {
      code: 'INVALID_JSON_VALUE',
      path: '$.recommendations',
      message: 'Accessor property: recommendations',
    });
  }

  let recommendationsLength = 0;
  const officialDateFromRoot: string | null =
    officialDateResult !== 'missing' && officialDateResult !== 'accessor'
      ? (officialDateResult as { kind: 'data'; value: string }).value
      : null;

  if (recommendationsDescriptor && isDataDescriptor(recommendationsDescriptor)) {
    const recommendationsValue = recommendationsDescriptor.value;
    if (!Array.isArray(recommendationsValue)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_ARRAY',
        path: '$.recommendations',
        message: 'recommendations must be an array',
      });
    } else {
      const array = recommendationsValue as unknown[];

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
          path: '$.recommendations',
          message: 'Sparse array',
        });
      }

      if (Object.getOwnPropertySymbols(array).length > 0) {
        pushUniqueIssue(issues, {
          code: 'UNKNOWN_FIELD',
          path: '$.recommendations[symbol]',
          message: 'Array symbol property',
        });
      }

      const ownNames = Object.getOwnPropertyNames(array);
      for (const key of ownNames) {
        if (key !== 'length' && !/^\d+$/.test(key)) {
          const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '');
          if (PROHIBITED_SET_FIELDS.has(normalizedKey)) {
            pushUniqueIssue(issues, {
              code: 'PROHIBITED_CONCEPT',
              path: `$.recommendations.${key}`,
              message: `Prohibited field: ${key}`,
            });
          } else {
            pushUniqueIssue(issues, {
              code: 'UNKNOWN_FIELD',
              path: `$.recommendations.${key}`,
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
              path: `$.recommendations[${key}]`,
              message: `Accessor property: ${key}`,
            });
          }
        }
      }

      if (!sparse && Object.getOwnPropertySymbols(array).length === 0) {
        recommendationsLength = array.length;

        for (let i = 0; i < array.length; i++) {
          const indexDescriptor = Object.getOwnPropertyDescriptor(array, i);
          if (!indexDescriptor || !isDataDescriptor(indexDescriptor)) {
            continue;
          }
          validateRecommendation(indexDescriptor.value, i, officialDateFromRoot ?? '', issues);
        }
      }
    }
  }

  if (recommendationCountResult !== 'missing' && recommendationCountResult !== 'accessor') {
    const recommendationCount = (recommendationCountResult as { kind: 'data'; value: unknown }).value;
    validateRecommendationCount(recommendationCount, recommendationsLength, '$.recommendationCount', issues);
  }

  if (recommendationsLength === 0) {
    pushUniqueIssue(issues, {
      code: 'EMPTY_RECOMMENDATION_SET',
      path: '$.recommendations',
      message: 'recommendations must contain at least one entry',
    });
  }

  const recommendationIds = new Set<string>();
  const gameIds = new Set<string>();
  for (let i = 0; i < recommendationsLength; i++) {
    const arrayDescriptor = Object.getOwnPropertyDescriptor(
      root.recommendations as unknown[],
      `${i}`,
    );
    if (!arrayDescriptor || !isDataDescriptor(arrayDescriptor)) {
      continue;
    }
    const recommendation = arrayDescriptor.value as Record<string, unknown>;

    const recommendationIdDescriptor = Object.getOwnPropertyDescriptor(recommendation, 'recommendationId');
    if (recommendationIdDescriptor && isDataDescriptor(recommendationIdDescriptor)) {
      const recommendationId = recommendationIdDescriptor.value as string | undefined;
      if (recommendationId !== undefined) {
        if (recommendationIds.has(recommendationId)) {
          pushUniqueIssue(issues, {
            code: 'DUPLICATE_RECOMMENDATION_ID',
            path: `$.recommendations[${i}].recommendationId`,
            message: `Duplicate recommendationId: ${recommendationId}`,
          });
        } else {
          recommendationIds.add(recommendationId);
        }
      }
    }

    const gameIdDescriptor = Object.getOwnPropertyDescriptor(recommendation, 'gameId');
    if (gameIdDescriptor && isDataDescriptor(gameIdDescriptor)) {
      const gameId = gameIdDescriptor.value as string | undefined;
      if (gameId !== undefined) {
        if (gameIds.has(gameId)) {
          pushUniqueIssue(issues, {
            code: 'DUPLICATE_GAME_ID',
            path: `$.recommendations[${i}].gameId`,
            message: `Duplicate gameId: ${gameId}`,
          });
        } else {
          gameIds.add(gameId);
        }
      }
    }
  }

  const canonicalArray =
    recommendationsLength > 0
      ? canonicalSort(
          Array.from({ length: recommendationsLength }, (_, i) => {
            const descriptor = Object.getOwnPropertyDescriptor(
              root.recommendations as unknown[],
              `${i}`,
            );
            return descriptor && isDataDescriptor(descriptor)
              ? (descriptor.value as MLBOfflineSinglePickRecommendation)
              : ({} as MLBOfflineSinglePickRecommendation);
          }),
        )
      : [];

  const expectedOrderMatches = canonicalArray.every((canonical, i) => {
    const descriptor = Object.getOwnPropertyDescriptor(
      root.recommendations as unknown[],
      `${i}`,
    );
    if (!descriptor || !isDataDescriptor(descriptor)) {
      return false;
    }
    const actual = descriptor.value as Record<string, unknown>;

    const recommendationIdDescriptor = Object.getOwnPropertyDescriptor(actual, 'recommendationId');
    const inferenceIdDescriptor = Object.getOwnPropertyDescriptor(actual, 'inferenceId');
    const gameIdDescriptor = Object.getOwnPropertyDescriptor(actual, 'gameId');
    const snapshotIdDescriptor = Object.getOwnPropertyDescriptor(actual, 'snapshotId');

    if (
      !recommendationIdDescriptor ||
      !isDataDescriptor(recommendationIdDescriptor) ||
      (recommendationIdDescriptor.value as string) !== canonical.recommendationId
    ) {
      return false;
    }
    if (
      !inferenceIdDescriptor ||
      !isDataDescriptor(inferenceIdDescriptor) ||
      (inferenceIdDescriptor.value as string) !== canonical.inferenceId
    ) {
      return false;
    }
    if (
      !gameIdDescriptor ||
      !isDataDescriptor(gameIdDescriptor) ||
      (gameIdDescriptor.value as string) !== canonical.gameId
    ) {
      return false;
    }
    if (
      !snapshotIdDescriptor ||
      !isDataDescriptor(snapshotIdDescriptor) ||
      (snapshotIdDescriptor.value as string) !== canonical.snapshotId
    ) {
      return false;
    }

    return true;
  });

  if (recommendationsLength > 0 && !expectedOrderMatches) {
    pushUniqueIssue(issues, {
      code: 'ORDER_MISMATCH',
      path: '$.recommendations',
      message: 'Recommendations must be in canonical order',
    });
  }

  const releaseIdFromRoot =
    releaseIdResult !== 'missing' && releaseIdResult !== 'accessor'
      ? (releaseIdResult as { kind: 'data'; value: unknown }).value
      : null;
  const slateIdFromRoot =
    slateIdResult !== 'missing' && slateIdResult !== 'accessor'
      ? (slateIdResult as { kind: 'data'; value: unknown }).value
      : null;

  if (
    typeof releaseIdFromRoot === 'string' &&
    typeof officialDateFromRoot === 'string'
  ) {
    const expectedRecommendationSetId =
      slateIdFromRoot !== null && typeof slateIdFromRoot === 'string'
        ? `${slateIdFromRoot}::offline-single-pick-recommendation-set-v1`
        : null;
    if (
      recommendationSetIdResult !== 'missing' &&
      recommendationSetIdResult !== 'accessor' &&
      expectedRecommendationSetId !== null
    ) {
      const recommendationSetId = (recommendationSetIdResult as { kind: 'data'; value: unknown }).value;
      if (recommendationSetId !== expectedRecommendationSetId) {
        issues.push({
          code: 'RECOMMENDATION_SET_ID_MISMATCH',
          path: '$.recommendationSetId',
          message: 'recommendationSetId does not match the deterministic formula',
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

  return { ok: true, value: proposed as MLBOfflineSinglePickRecommendationSet };
}

export function buildMLBOfflineSinglePickRecommendationSet(
  input: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineSinglePickRecommendationSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineSinglePickRecommendationSetIssue[];
    }> {
  const sourceValidation = validateMLBOfflinePredictionSlate(input);
  if (!sourceValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_SLATE_INVALID',
          path: '$.predictionSlate',
          message: 'Source prediction slate is invalid',
        },
      ]),
    };
  }

  const slate = sourceValidation.value;

  const recommendations: MLBOfflineSinglePickRecommendation[] = [];
  for (let i = 0; i < slate.predictions.length; i++) {
    const prediction = slate.predictions[i];
    recommendations.push(buildRecommendation(prediction));
  }

  const sorted = canonicalSort(recommendations);
  const root = buildRoot(slate, sorted);

  const validation = validateMLBOfflineSinglePickRecommendationSet(root);
  if (!validation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'GENERATED_RECOMMENDATION_SET_INVALID',
          path: '$',
          message: 'Generated recommendation set failed validation',
        },
      ]),
    };
  }

  try {
    assertNoOddsContamination(root);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ODDS_CONTAMINATION')) {
      return {
        ok: false,
        issues: normalizeIssues([
          {
            code: 'ODDS_CONTAMINATION',
            path: '$',
            message: 'Odds contamination detected',
          },
        ]),
      };
    }
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'INVALID_JSON_VALUE',
          path: '$',
          message: 'Uninspectable accessor property',
        },
      ]),
    };
  }

  return { ok: true, value: root };
}
