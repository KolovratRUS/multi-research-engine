import { assertNoOddsContamination, isProhibitedOddsBoundaryKey, isProhibitedOddsKey } from '../firewall/odds-contamination-guard';
import {
  type MLBOfflineSinglePickRecommendation,
  validateMLBOfflineSinglePickRecommendationSet,
} from './mlb-offline-single-pick-recommendation-contract';

export const MLB_OFFLINE_MULTI_CANDIDATE_SET_CONTRACT_VERSION =
  'mlb-offline-candidate-set-v1' as const;

export const MLB_OFFLINE_MULTI_CANDIDATE_POLICY =
  'ALL_UNORDERED_2_AND_3_LEG_COMBINATIONS_V1' as const;

export const MLB_OFFLINE_MULTI_CANDIDATE_ORDER_POLICY =
  'MINIMUM_CONFIDENCE_DESC_MEAN_CONFIDENCE_DESC_LEG_COUNT_ASC_CANDIDATE_ID_ASC_V1' as const;

export type MLBOfflineMultiCandidateLeg = MLBOfflineSinglePickRecommendation;

export type MLBOfflineMultiCandidate = Readonly<{
  candidateId: string;
  legCount: 2 | 3;
  minimumLegConfidence: number;
  meanLegConfidence: number;
  maximumLegUncertainty: number;
  legs: readonly MLBOfflineMultiCandidateLeg[];
}>;

export type MLBOfflineMultiCandidateSet = Readonly<{
  contractVersion: 'mlb-offline-candidate-set-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  candidateSetId: string;
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
  sourceRecommendationPolicy: 'ALL_VALIDATED_PREDICTIONS_V1';
  candidatePolicy: 'ALL_UNORDERED_2_AND_3_LEG_COMBINATIONS_V1';
  orderPolicy: 'MINIMUM_CONFIDENCE_DESC_MEAN_CONFIDENCE_DESC_LEG_COUNT_ASC_CANDIDATE_ID_ASC_V1';
  sourceRecommendationCount: number;
  sourceRecommendationIds: readonly string[];
  candidateCount: number;
  candidates: readonly MLBOfflineMultiCandidate[];
}>;

export type MLBOfflineMultiCandidateSetIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'SOURCE_RECOMMENDATION_SET_INVALID'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'CANDIDATE_INVALID'
    | 'LEG_INVALID'
    | 'DUPLICATE_SOURCE_RECOMMENDATION_ID'
    | 'DUPLICATE_CANDIDATE_ID'
    | 'DUPLICATE_LEG_RECOMMENDATION_ID'
    | 'DUPLICATE_LEG_GAME_ID'
    | 'ORDER_MISMATCH'
    | 'CANDIDATE_ID_MISMATCH'
    | 'CANDIDATE_SET_ID_MISMATCH'
    | 'SOURCE_RECOMMENDATION_COUNT_MISMATCH'
    | 'CANDIDATE_COUNT_MISMATCH'
    | 'LEG_COUNT_MISMATCH'
    | 'MINIMUM_CONFIDENCE_MISMATCH'
    | 'MEAN_CONFIDENCE_MISMATCH'
    | 'MAXIMUM_UNCERTAINTY_MISMATCH'
    | 'CANDIDATE_COMPLETENESS_MISMATCH'
    | 'GENERATED_CANDIDATE_SET_INVALID'
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
  issues: MLBOfflineMultiCandidateSetIssue[],
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
  issues: MLBOfflineMultiCandidateSetIssue[],
  issue: MLBOfflineMultiCandidateSetIssue,
): void {
  const exists = issues.some(
    (item) => item.path === issue.path && item.code === issue.code,
  );
  if (!exists) {
    issues.push(issue);
  }
}

function normalizeIssues(
  issues: MLBOfflineMultiCandidateSetIssue[],
): readonly MLBOfflineMultiCandidateSetIssue[] {
  const unique = new Map<string, MLBOfflineMultiCandidateSetIssue>();
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
  'candidateSetId',
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
  'sourceRecommendationPolicy',
  'candidatePolicy',
  'orderPolicy',
  'sourceRecommendationCount',
  'sourceRecommendationIds',
  'candidateCount',
  'candidates',
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
  'sportsbook',
]);

const KNOWN_CANDIDATE_FIELDS = new Set([
  'candidateId',
  'legCount',
  'minimumLegConfidence',
  'meanLegConfidence',
  'maximumLegUncertainty',
  'legs',
]);

const PROHIBITED_CANDIDATE_FIELDS = new Set([
  'odds',
  'price',
  'line',
  'market',
  'edge',
  'value',
  'payout',
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

const KNOWN_LEG_FIELDS = new Set([
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

const PROHIBITED_LEG_FIELDS = new Set([
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

function validateObjectFields(
  root: Record<string, unknown>,
  known: Set<string>,
  prohibited: Set<string>,
  prefix: string,
  issues: MLBOfflineMultiCandidateSetIssue[],
): void {
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `${prefix}[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!known.has(key)) {
      if (prohibited.has(key)) {
        if (isProhibitedOddsKey(key)) {
          // Skip; assertNoOddsContamination will map these to ODDS_CONTAMINATION
        } else {
          pushUniqueIssue(issues, {
            code: 'PROHIBITED_CONCEPT',
            path: `${prefix}.${key}`,
            message: `Prohibited field: ${key}`,
          });
        }
      } else {
        pushUniqueIssue(issues, {
          code: 'UNKNOWN_FIELD',
          path: `${prefix}.${key}`,
          message: `Unknown field: ${key}`,
        });
      }
    }
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (known.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: `${prefix}.${key}`,
          message: `Accessor property: ${key}`,
        });
      }
    }
  }
}

function validateArrayDescriptor(
  value: unknown,
  prefix: string,
  issues: MLBOfflineMultiCandidateSetIssue[],
): value is unknown[] {
  if (!Array.isArray(value)) {
    issues.push({
      code: 'INVALID_ARRAY',
      path: prefix,
      message: `${prefix} must be an array`,
    });
    return false;
  }

  const array = value as unknown[];

  let sparse = false;
  for (let i = 0; i < array.length; i++) {
    if (!(i in array)) {
      sparse = true;
      break;
    }
  }
  if (sparse) {
    issues.push({
      code: 'INVALID_ARRAY',
      path: prefix,
      message: 'Sparse array',
    });
  }

  if (Object.getOwnPropertySymbols(array).length > 0) {
    issues.push({
      code: 'UNKNOWN_FIELD',
      path: `${prefix}[symbol]`,
      message: 'Array symbol property',
    });
  }

  const ownNames = Object.getOwnPropertyNames(array);
  for (const key of ownNames) {
    if (key !== 'length' && !/^\d+$/.test(key)) {
      const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]+/g, '');
      if (PROHIBITED_SET_FIELDS.has(normalizedKey) && !isProhibitedOddsKey(key)) {
        issues.push({
          code: 'PROHIBITED_CONCEPT',
          path: `${prefix}.${key}`,
          message: `Prohibited field: ${key}`,
        });
      } else if (!PROHIBITED_SET_FIELDS.has(normalizedKey)) {
        issues.push({
          code: 'UNKNOWN_FIELD',
          path: `${prefix}.${key}`,
          message: `Unknown field: ${key}`,
        });
      }
    }
  }

  for (const key of ownNames) {
    if (/^\d+$/.test(key)) {
      const indexDescriptor = Object.getOwnPropertyDescriptor(array, key);
      if (indexDescriptor && !isDataDescriptor(indexDescriptor)) {
        issues.push({
          code: 'INVALID_JSON_VALUE',
          path: `${prefix}[${key}]`,
          message: `Accessor property: ${key}`,
        });
      }
    }
  }

  const hasAccessor = issues.some((issue) => issue.code === 'INVALID_JSON_VALUE' && issue.path.startsWith(`${prefix}[`));
  return !hasAccessor;
}

function validateRecommendationCount(
  value: unknown,
  expectedLength: number,
  path: string,
  issues: MLBOfflineMultiCandidateSetIssue[],
): void {
  if (typeof value !== 'number') {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'sourceRecommendationCount must be a number',
    });
    return;
  }
  if (!Number.isSafeInteger(value)) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'sourceRecommendationCount must be a safe integer',
    });
    return;
  }
  if (value < 0) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'sourceRecommendationCount must be non-negative',
    });
    return;
  }
  if (Object.is(value, -0)) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'sourceRecommendationCount must not be negative zero',
    });
    return;
  }
  if (value !== expectedLength) {
    issues.push({
      code: 'SOURCE_RECOMMENDATION_COUNT_MISMATCH',
      path,
      message: 'sourceRecommendationCount must equal sourceRecommendationIds.length',
    });
  }
}

function validateCandidateCount(
  value: unknown,
  expectedLength: number,
  expectedFormula: number,
  path: string,
  issues: MLBOfflineMultiCandidateSetIssue[],
): void {
  if (typeof value !== 'number') {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'candidateCount must be a number',
    });
    return;
  }
  if (!Number.isSafeInteger(value)) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'candidateCount must be a safe integer',
    });
    return;
  }
  if (value < 0) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'candidateCount must be non-negative',
    });
    return;
  }
  if (Object.is(value, -0)) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'candidateCount must not be negative zero',
    });
    return;
  }
  if (value !== expectedLength || value !== expectedFormula) {
    issues.push({
      code: 'CANDIDATE_COUNT_MISMATCH',
      path,
      message: 'candidateCount must equal candidates.length and the required formula',
    });
  }
}

function validateLegCount(
  value: unknown,
  expectedLength: number,
  path: string,
  issues: MLBOfflineMultiCandidateSetIssue[],
): void {
  if (typeof value !== 'number') {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'legCount must be a number',
    });
    return;
  }
  if (!Number.isSafeInteger(value)) {
    issues.push({
      code: 'INVALID_NUMBER',
      path,
      message: 'legCount must be a safe integer',
    });
    return;
  }
  if (value !== 2 && value !== 3) {
    issues.push({
      code: 'LEG_COUNT_MISMATCH',
      path,
      message: 'legCount must be 2 or 3',
    });
    return;
  }
  if (value !== expectedLength) {
    issues.push({
      code: 'LEG_COUNT_MISMATCH',
      path,
      message: 'legCount must equal legs.length',
    });
  }
}

function isCanonicalLegOrder(
  legs: readonly MLBOfflineMultiCandidateLeg[],
): boolean {
  for (let i = 1; i < legs.length; i++) {
    const prev = legs[i - 1];
    const curr = legs[i];
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

function isCanonicalCandidateOrder(
  candidates: readonly MLBOfflineMultiCandidate[],
): boolean {
  for (let i = 1; i < candidates.length; i++) {
    const prev = candidates[i - 1];
    const curr = candidates[i];
    if (prev.minimumLegConfidence < curr.minimumLegConfidence) return false;
    if (prev.minimumLegConfidence === curr.minimumLegConfidence) {
      if (prev.meanLegConfidence < curr.meanLegConfidence) return false;
      if (prev.meanLegConfidence === curr.meanLegConfidence) {
        if (prev.legCount > curr.legCount) return false;
        if (prev.legCount === curr.legCount) {
          if (prev.candidateId > curr.candidateId) return false;
        }
      }
    }
  }
  return true;
}

function candidateIdFor(
  candidate: MLBOfflineMultiCandidate,
  recommendationSetId: string,
): string {
  const ids = candidate.legs
    .map((leg) => leg.recommendationId)
    .slice()
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const encoded = ids.map((id) => `${id.length}:${id}`).join('|');
  return `${recommendationSetId}::${candidate.legCount}::${encoded}::offline-candidate-v1`;
}

function validateProbabilityObject(
  value: unknown,
  prefix: string,
  issues: MLBOfflineMultiCandidateSetIssue[],
): { homeWinProbability: number; awayWinProbability: number } | null {
  if (!isPlainObject(value)) {
    issues.push({
      code: 'NOT_PLAIN_OBJECT',
      path: prefix,
      message: 'probabilities must be a plain object',
    });
    return null;
  }

  validateObjectFields(value, KNOWN_PROBABILITY_FIELDS, PROHIBITED_LEG_FIELDS, prefix, issues);

  const homeResult = ownDataProperty(value, 'homeWinProbability', `${prefix}.homeWinProbability`, issues);
  const awayResult = ownDataProperty(value, 'awayWinProbability', `${prefix}.awayWinProbability`, issues);

  let homeWinProbability: number | null = null;
  let awayWinProbability: number | null = null;

  if (homeResult !== 'missing' && homeResult !== 'accessor') {
    const homeValue = (homeResult as { kind: 'data'; value: unknown }).value;
    if (typeof homeValue !== 'number' || !Number.isFinite(homeValue) || homeValue < 0 || homeValue > 1) {
      issues.push({
        code: 'LEG_INVALID',
        path: `${prefix}.homeWinProbability`,
        message: 'homeWinProbability must be a finite number in [0,1]',
      });
    } else {
      homeWinProbability = homeValue;
    }
  }

  if (awayResult !== 'missing' && awayResult !== 'accessor') {
    const awayValue = (awayResult as { kind: 'data'; value: unknown }).value;
    if (typeof awayValue !== 'number' || !Number.isFinite(awayValue) || awayValue < 0 || awayValue > 1) {
      issues.push({
        code: 'LEG_INVALID',
        path: `${prefix}.awayWinProbability`,
        message: 'awayWinProbability must be a finite number in [0,1]',
      });
    } else {
      awayWinProbability = awayValue;
    }
  }

  if (homeWinProbability !== null && awayWinProbability !== null && awayWinProbability !== 1 - homeWinProbability) {
    issues.push({
      code: 'LEG_INVALID',
      path: prefix,
      message: 'awayWinProbability must equal 1 - homeWinProbability',
    });
  }

  if (homeWinProbability === null || awayWinProbability === null) {
    return null;
  }

  return { homeWinProbability, awayWinProbability };
}

function validateLeg(
  legValue: unknown,
  index: number,
  setOfficialDate: string,
  sourceIdSet: Set<string>,
  issues: MLBOfflineMultiCandidateSetIssue[],
): MLBOfflineMultiCandidateLeg | null {
  const prefix = `$.candidates[?].legs[${index}]`;
  if (!isPlainObject(legValue)) {
    issues.push({
      code: 'NOT_PLAIN_OBJECT',
      path: prefix,
      message: 'Leg must be a plain object',
    });
    return null;
  }

  const legRoot = legValue as Record<string, unknown>;
  validateObjectFields(legRoot, KNOWN_LEG_FIELDS, PROHIBITED_LEG_FIELDS, prefix, issues);

  const recommendationIdResult = ownDataProperty(legRoot, 'recommendationId', `${prefix}.recommendationId`, issues);
  const inferenceIdResult = ownDataProperty(legRoot, 'inferenceId', `${prefix}.inferenceId`, issues);
  const snapshotIdResult = ownDataProperty(legRoot, 'snapshotId', `${prefix}.snapshotId`, issues);
  const gameIdResult = ownDataProperty(legRoot, 'gameId', `${prefix}.gameId`, issues);
  const officialDateResult = ownDataProperty(legRoot, 'officialDate', `${prefix}.officialDate`, issues);
  const dataCutoffAtResult = ownDataProperty(legRoot, 'dataCutoffAt', `${prefix}.dataCutoffAt`, issues);
  const homeTeamIdResult = ownDataProperty(legRoot, 'homeTeamId', `${prefix}.homeTeamId`, issues);
  const awayTeamIdResult = ownDataProperty(legRoot, 'awayTeamId', `${prefix}.awayTeamId`, issues);
  const recommendedSideResult = ownDataProperty(legRoot, 'recommendedSide', `${prefix}.recommendedSide`, issues);
  const recommendedTeamIdResult = ownDataProperty(legRoot, 'recommendedTeamId', `${prefix}.recommendedTeamId`, issues);
  const probabilitiesResult = ownDataProperty(legRoot, 'probabilities', `${prefix}.probabilities`, issues);
  const modelConfidenceResult = ownDataProperty(legRoot, 'modelConfidence', `${prefix}.modelConfidence`, issues);
  const modelUncertaintyResult = ownDataProperty(legRoot, 'modelUncertainty', `${prefix}.modelUncertainty`, issues);

  let recommendationId: unknown | null = null;
  if (recommendationIdResult !== 'missing' && recommendationIdResult !== 'accessor') {
    recommendationId = (recommendationIdResult as { kind: 'data'; value: unknown }).value;
  }
  let inferenceId: unknown | null = null;
  if (inferenceIdResult !== 'missing' && inferenceIdResult !== 'accessor') {
    inferenceId = (inferenceIdResult as { kind: 'data'; value: unknown }).value;
  }
  let snapshotId: unknown | null = null;
  if (snapshotIdResult !== 'missing' && snapshotIdResult !== 'accessor') {
    snapshotId = (snapshotIdResult as { kind: 'data'; value: unknown }).value;
  }
  let gameId: unknown | null = null;
  if (gameIdResult !== 'missing' && gameIdResult !== 'accessor') {
    gameId = (gameIdResult as { kind: 'data'; value: unknown }).value;
  }
  let officialDate: unknown | null = null;
  if (officialDateResult !== 'missing' && officialDateResult !== 'accessor') {
    officialDate = (officialDateResult as { kind: 'data'; value: unknown }).value;
  }
  let dataCutoffAt: unknown | null = null;
  if (dataCutoffAtResult !== 'missing' && dataCutoffAtResult !== 'accessor') {
    dataCutoffAt = (dataCutoffAtResult as { kind: 'data'; value: unknown }).value;
  }
  let homeTeamId: unknown | null = null;
  if (homeTeamIdResult !== 'missing' && homeTeamIdResult !== 'accessor') {
    homeTeamId = (homeTeamIdResult as { kind: 'data'; value: unknown }).value;
  }
  let awayTeamId: unknown | null = null;
  if (awayTeamIdResult !== 'missing' && awayTeamIdResult !== 'accessor') {
    awayTeamId = (awayTeamIdResult as { kind: 'data'; value: unknown }).value;
  }
  let recommendedSide: unknown | null = null;
  if (recommendedSideResult !== 'missing' && recommendedSideResult !== 'accessor') {
    recommendedSide = (recommendedSideResult as { kind: 'data'; value: unknown }).value;
  }
  let recommendedTeamId: unknown | null = null;
  if (recommendedTeamIdResult !== 'missing' && recommendedTeamIdResult !== 'accessor') {
    recommendedTeamId = (recommendedTeamIdResult as { kind: 'data'; value: unknown }).value;
  }
  let probabilities: unknown | null = null;
  if (probabilitiesResult !== 'missing' && probabilitiesResult !== 'accessor') {
    probabilities = (probabilitiesResult as { kind: 'data'; value: unknown }).value;
  }
  let modelConfidence: unknown | null = null;
  if (modelConfidenceResult !== 'missing' && modelConfidenceResult !== 'accessor') {
    modelConfidence = (modelConfidenceResult as { kind: 'data'; value: unknown }).value;
  }
  let modelUncertainty: unknown | null = null;
  if (modelUncertaintyResult !== 'missing' && modelUncertaintyResult !== 'accessor') {
    modelUncertainty = (modelUncertaintyResult as { kind: 'data'; value: unknown }).value;
  }

  if (!isStrictNonEmptyTrimmedString(recommendationId)) {
    issues.push({
      code: 'INVALID_STRING',
      path: `${prefix}.recommendationId`,
      message: 'recommendationId must be a valid identifier',
    });
  }

  if (!isStrictNonEmptyTrimmedString(inferenceId)) {
    issues.push({
      code: 'INVALID_STRING',
      path: `${prefix}.inferenceId`,
      message: 'inferenceId must be a valid identifier',
    });
  }

  if (!isStrictNonEmptyTrimmedString(snapshotId)) {
    issues.push({
      code: 'INVALID_STRING',
      path: `${prefix}.snapshotId`,
      message: 'snapshotId must be a valid identifier',
    });
  }

  if (!isStrictNonEmptyTrimmedString(gameId)) {
    issues.push({
      code: 'INVALID_STRING',
      path: `${prefix}.gameId`,
      message: 'gameId must be a valid identifier',
    });
  }

  if (typeof officialDate !== 'string' || !isValidGregorianDate(officialDate)) {
    issues.push({
      code: 'INVALID_STRING',
      path: `${prefix}.officialDate`,
      message: 'officialDate must be a valid calendar date',
    });
  } else if (officialDate !== setOfficialDate) {
    issues.push({
      code: 'SOURCE_IDENTITY_MISMATCH',
      path: `${prefix}.officialDate`,
      message: 'leg officialDate must equal the candidate-set officialDate',
    });
  }

  if (typeof dataCutoffAt !== 'string' || !isValidRfc3339Timestamp(dataCutoffAt)) {
    issues.push({
      code: 'INVALID_STRING',
      path: `${prefix}.dataCutoffAt`,
      message: 'dataCutoffAt must be a valid RFC3339 timestamp',
    });
  }

  if (!isStrictNonEmptyTrimmedString(homeTeamId)) {
    issues.push({
      code: 'INVALID_STRING',
      path: `${prefix}.homeTeamId`,
      message: 'homeTeamId must be a valid identifier',
    });
  }

  if (!isStrictNonEmptyTrimmedString(awayTeamId)) {
    issues.push({
      code: 'INVALID_STRING',
      path: `${prefix}.awayTeamId`,
      message: 'awayTeamId must be a valid identifier',
    });
  }

  if (recommendedSide !== 'HOME' && recommendedSide !== 'AWAY') {
    issues.push({
      code: 'INVALID_LITERAL',
      path: `${prefix}.recommendedSide`,
      message: 'recommendedSide must be HOME or AWAY',
    });
  }

  if (!isStrictNonEmptyTrimmedString(recommendedTeamId)) {
    issues.push({
      code: 'INVALID_STRING',
      path: `${prefix}.recommendedTeamId`,
      message: 'recommendedTeamId must be a valid identifier',
    });
  }

  const probabilitiesData = validateProbabilityObject(probabilities, `${prefix}.probabilities`, issues);

  if (typeof modelConfidence !== 'number' || !Number.isFinite(modelConfidence) || modelConfidence < 0 || modelConfidence > 1) {
    issues.push({
      code: 'LEG_INVALID',
      path: `${prefix}.modelConfidence`,
      message: 'modelConfidence must be a finite number in [0,1]',
    });
  }

  if (typeof modelUncertainty !== 'number' || !Number.isFinite(modelUncertainty) || modelUncertainty < 0 || modelUncertainty > 1) {
    issues.push({
      code: 'LEG_INVALID',
      path: `${prefix}.modelUncertainty`,
      message: 'modelUncertainty must be a finite number in [0,1]',
    });
  }

  if (
    typeof recommendationId === 'string' &&
    typeof inferenceId === 'string' &&
    recommendationId !== `${inferenceId}::offline-single-pick-recommendation-v1`
  ) {
    issues.push({
      code: 'LEG_INVALID',
      path: `${prefix}.recommendationId`,
      message: 'recommendationId must equal inferenceId::offline-single-pick-recommendation-v1',
    });
  }

  if (
    recommendedSide === 'HOME' &&
    typeof modelConfidence === 'number' &&
    typeof homeTeamId === 'string' &&
    probabilitiesData !== null
  ) {
    if (modelConfidence !== probabilitiesData.homeWinProbability) {
      issues.push({
        code: 'LEG_INVALID',
        path: `${prefix}.modelConfidence`,
        message: 'modelConfidence must equal homeWinProbability when recommendedSide is HOME',
      });
    }
    if (modelUncertainty !== probabilitiesData.awayWinProbability) {
      issues.push({
        code: 'LEG_INVALID',
        path: `${prefix}.modelUncertainty`,
        message: 'modelUncertainty must equal awayWinProbability when recommendedSide is HOME',
      });
    }
    if (recommendedTeamId !== homeTeamId) {
      issues.push({
        code: 'LEG_INVALID',
        path: `${prefix}.recommendedTeamId`,
        message: 'recommendedTeamId must equal homeTeamId when recommendedSide is HOME',
      });
    }
  }

  if (
    recommendedSide === 'AWAY' &&
    typeof modelConfidence === 'number' &&
    typeof awayTeamId === 'string' &&
    probabilitiesData !== null
  ) {
    if (modelConfidence !== probabilitiesData.awayWinProbability) {
      issues.push({
        code: 'LEG_INVALID',
        path: `${prefix}.modelConfidence`,
        message: 'modelConfidence must equal awayWinProbability when recommendedSide is AWAY',
      });
    }
    if (modelUncertainty !== probabilitiesData.homeWinProbability) {
      issues.push({
        code: 'LEG_INVALID',
        path: `${prefix}.modelUncertainty`,
        message: 'modelUncertainty must equal homeWinProbability when recommendedSide is AWAY',
      });
    }
    if (recommendedTeamId !== awayTeamId) {
      issues.push({
        code: 'LEG_INVALID',
        path: `${prefix}.recommendedTeamId`,
        message: 'recommendedTeamId must equal awayTeamId when recommendedSide is AWAY',
      });
    }
  }

  if (
    typeof recommendationId !== 'string' ||
    typeof inferenceId !== 'string' ||
    typeof snapshotId !== 'string' ||
    typeof gameId !== 'string'
  ) {
    return null;
  }

  if (!sourceIdSet.has(recommendationId)) {
    issues.push({
      code: 'LEG_INVALID',
      path: `${prefix}.recommendationId`,
      message: `Unknown recommendationId: ${recommendationId}`,
    });
  }

  const resolvedHomeTeamId = typeof homeTeamId === 'string' ? homeTeamId : '';
  const resolvedAwayTeamId = typeof awayTeamId === 'string' ? awayTeamId : '';
  const resolvedRecommendedSide = recommendedSide === 'HOME' || recommendedSide === 'AWAY'
    ? (recommendedSide as 'HOME' | 'AWAY')
    : 'HOME';
  const resolvedRecommendedTeamId = typeof recommendedTeamId === 'string' ? recommendedTeamId : '';

  return {
    recommendationId,
    inferenceId,
    snapshotId,
    gameId,
    officialDate: typeof officialDate === 'string' ? officialDate : '',
    dataCutoffAt: typeof dataCutoffAt === 'string' ? dataCutoffAt : '',
    homeTeamId: resolvedHomeTeamId,
    awayTeamId: resolvedAwayTeamId,
    recommendedSide: resolvedRecommendedSide,
    recommendedTeamId: resolvedRecommendedTeamId,
    probabilities: probabilitiesData ?? { homeWinProbability: 0, awayWinProbability: 0 },
    modelConfidence: typeof modelConfidence === 'number' ? modelConfidence : 0,
    modelUncertainty: typeof modelUncertainty === 'number' ? modelUncertainty : 0,
  };
}

export function validateMLBOfflineMultiCandidateSet(
  proposed: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineMultiCandidateSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineMultiCandidateSetIssue[];
    }> {
  const issues: MLBOfflineMultiCandidateSetIssue[] = [];

  if (!isPlainObject(proposed)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Candidate set must be a plain object' },
      ]),
    };
  }

  const root = proposed as Record<string, unknown>;

  for (const key of Object.getOwnPropertyNames(root)) {
    if (isProhibitedOddsBoundaryKey(key)) {
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
        if (isProhibitedOddsKey(key)) {
          // Skip; assertNoOddsContamination will map these to ODDS_CONTAMINATION
        } else {
          pushUniqueIssue(issues, {
            code: 'PROHIBITED_CONCEPT',
            path: `$.${key}`,
            message: `Prohibited field: ${key}`,
          });
        }
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

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.contractVersion',
      message: 'contractVersion is required',
    });
  } else if (contractVersionResult !== 'accessor') {
    const contractVersion = (contractVersionResult as { kind: 'data'; value: unknown }).value;
    if (contractVersion !== MLB_OFFLINE_MULTI_CANDIDATE_SET_CONTRACT_VERSION) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.contractVersion',
        message: `contractVersion must be ${MLB_OFFLINE_MULTI_CANDIDATE_SET_CONTRACT_VERSION}`,
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

  const targetEncodingResult = ownDataProperty(root, 'targetEncoding', '$.targetEncoding', issues);
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

  let candidateSetId: string | null = null;
  const candidateSetIdResult = ownDataProperty(root, 'candidateSetId', '$.candidateSetId', issues);
  if (candidateSetIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.candidateSetId',
      message: 'candidateSetId is required',
    });
  } else if (candidateSetIdResult !== 'accessor') {
    const rawValue = (candidateSetIdResult as { kind: 'data'; value: unknown }).value;
    if (typeof rawValue === 'string') {
      candidateSetId = rawValue;
      if (!isStrictNonEmptyTrimmedString(candidateSetId)) {
        issues.push({
          code: 'INVALID_STRING',
          path: '$.candidateSetId',
          message: 'candidateSetId must be a valid identifier',
        });
      }
    } else {
      issues.push({
        code: 'INVALID_STRING',
        path: '$.candidateSetId',
        message: 'candidateSetId must be a valid identifier',
      });
    }
  }

  let recommendationSetId: string | null = null;
  const recommendationSetIdResult = ownDataProperty(root, 'recommendationSetId', '$.recommendationSetId', issues);
  if (recommendationSetIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.recommendationSetId',
      message: 'recommendationSetId is required',
    });
  } else if (recommendationSetIdResult !== 'accessor') {
    const rawValue = (recommendationSetIdResult as { kind: 'data'; value: unknown }).value;
    if (typeof rawValue === 'string') {
      recommendationSetId = rawValue;
      if (!isStrictNonEmptyTrimmedString(recommendationSetId)) {
        issues.push({
          code: 'INVALID_STRING',
          path: '$.recommendationSetId',
          message: 'recommendationSetId must be a valid identifier',
        });
      }
    } else {
      issues.push({
        code: 'INVALID_STRING',
        path: '$.recommendationSetId',
        message: 'recommendationSetId must be a valid identifier',
      });
    }
  }

  const lineageFields: Array<{ key: string; path: string }> = [
    { key: 'slateId', path: '$.slateId' },
    { key: 'releaseId', path: '$.releaseId' },
    { key: 'modelId', path: '$.modelId' },
    { key: 'planId', path: '$.planId' },
    { key: 'matrixId', path: '$.matrixId' },
    { key: 'configId', path: '$.configId' },
    { key: 'manifestId', path: '$.manifestId' },
  ];

  const lineageValues: Record<string, string> = {};

  for (const field of lineageFields) {
    const result = ownDataProperty(root, field.key, field.path, issues);
    if (result === 'missing') {
      pushUniqueIssue(issues, {
        code: 'MISSING_FIELD',
        path: field.path,
        message: `${field.key} is required`,
      });
    } else if (result !== 'accessor') {
      const value = (result as { kind: 'data'; value: unknown }).value;
      if (!isStrictNonEmptyTrimmedString(value)) {
        issues.push({
          code: 'INVALID_STRING',
          path: field.path,
          message: `${field.key} must be a valid identifier`,
        });
      } else {
        lineageValues[field.key] = value as string;
      }
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

  const decisionPolicyResult = ownDataProperty(root, 'decisionPolicy', '$.decisionPolicy', issues);
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

  const officialDateResult = ownDataProperty(root, 'officialDate', '$.officialDate', issues);
  let officialDate: string | null = null;
  if (officialDateResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.officialDate',
      message: 'officialDate is required',
    });
  } else if (officialDateResult !== 'accessor') {
    const value = (officialDateResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'string' || !isValidGregorianDate(value)) {
      issues.push({
        code: 'INVALID_STRING',
        path: '$.officialDate',
        message: 'officialDate must be a valid calendar date',
      });
    } else {
      officialDate = value;
    }
  }

  const sourceRecommendationPolicyResult = ownDataProperty(root, 'sourceRecommendationPolicy', '$.sourceRecommendationPolicy', issues);
  if (sourceRecommendationPolicyResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sourceRecommendationPolicy',
      message: 'sourceRecommendationPolicy is required',
    });
  } else if (sourceRecommendationPolicyResult !== 'accessor') {
    const sourceRecommendationPolicy = (sourceRecommendationPolicyResult as { kind: 'data'; value: unknown }).value;
    if (sourceRecommendationPolicy !== 'ALL_VALIDATED_PREDICTIONS_V1') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.sourceRecommendationPolicy',
        message: 'sourceRecommendationPolicy must be ALL_VALIDATED_PREDICTIONS_V1',
      });
    }
  }

  const candidatePolicyResult = ownDataProperty(root, 'candidatePolicy', '$.candidatePolicy', issues);
  if (candidatePolicyResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.candidatePolicy',
      message: 'candidatePolicy is required',
    });
  } else if (candidatePolicyResult !== 'accessor') {
    const candidatePolicy = (candidatePolicyResult as { kind: 'data'; value: unknown }).value;
    if (candidatePolicy !== MLB_OFFLINE_MULTI_CANDIDATE_POLICY) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.candidatePolicy',
        message: `candidatePolicy must be ${MLB_OFFLINE_MULTI_CANDIDATE_POLICY}`,
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
    if (orderPolicy !== MLB_OFFLINE_MULTI_CANDIDATE_ORDER_POLICY) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.orderPolicy',
        message: `orderPolicy must be ${MLB_OFFLINE_MULTI_CANDIDATE_ORDER_POLICY}`,
      });
    }
  }

  const sourceRecommendationCountResult = ownDataProperty(
    root,
    'sourceRecommendationCount',
    '$.sourceRecommendationCount',
    issues,
  );

  const sourceRecommendationIdsResult = ownDataProperty(
    root,
    'sourceRecommendationIds',
    '$.sourceRecommendationIds',
    issues,
  );
  let validSourceIds: string[] = [];
  let sourceIdSet = new Set<string>();
  let sourceIdsValid = true;
  if (sourceRecommendationIdsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sourceRecommendationIds',
      message: 'sourceRecommendationIds is required',
    });
    sourceIdsValid = false;
  } else if (sourceRecommendationIdsResult !== 'accessor') {
    const sourceRecommendationIdsValue = (sourceRecommendationIdsResult as { kind: 'data'; value: unknown }).value;
    if (Array.isArray(sourceRecommendationIdsValue)) {
      if (!validateArrayDescriptor(sourceRecommendationIdsValue, '$.sourceRecommendationIds', issues)) {
        sourceIdsValid = false;
      } else {
        const array = sourceRecommendationIdsValue as unknown[];
        const seen = new Set<string>();
        const ids: string[] = [];
        for (let i = 0; i < array.length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(array, `${i}`);
          if (!descriptor || !isDataDescriptor(descriptor)) {
            continue;
          }
          const value = descriptor.value;
          if (!isStrictNonEmptyTrimmedString(value)) {
            issues.push({
              code: 'INVALID_STRING',
              path: `$.sourceRecommendationIds[${i}]`,
              message: 'sourceRecommendationIds must be valid identifiers',
            });
            sourceIdsValid = false;
          } else {
            if (seen.has(value)) {
              issues.push({
                code: 'DUPLICATE_SOURCE_RECOMMENDATION_ID',
                path: `$.sourceRecommendationIds[${i}]`,
                message: `Duplicate source recommendationId: ${value}`,
              });
              sourceIdsValid = false;
            } else {
              seen.add(value);
              ids.push(value);
            }
          }
        }
        for (let i = 1; i < ids.length; i++) {
          if (ids[i] < ids[i - 1]) {
            issues.push({
              code: 'ORDER_MISMATCH',
              path: '$.sourceRecommendationIds',
              message: 'sourceRecommendationIds must be in canonical order',
            });
            break;
          }
        }
        validSourceIds = ids;
        sourceIdSet = seen;
      }
    } else {
      issues.push({
        code: 'INVALID_ARRAY',
        path: '$.sourceRecommendationIds',
        message: 'sourceRecommendationIds must be an array',
      });
      sourceIdsValid = false;
    }
  }

  if (sourceIdsValid && sourceRecommendationCountResult !== 'missing' && sourceRecommendationCountResult !== 'accessor') {
    const sourceRecommendationCount = (sourceRecommendationCountResult as { kind: 'data'; value: unknown }).value;
    const beforeCount = issues.length;
    validateRecommendationCount(sourceRecommendationCount, validSourceIds.length, '$.sourceRecommendationCount', issues);
    if (issues.length > beforeCount) {
      sourceIdsValid = false;
    }
  }

  const candidateCountResult = ownDataProperty(root, 'candidateCount', '$.candidateCount', issues);
  if (candidateCountResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.candidateCount',
      message: 'candidateCount is required',
    });
  }

  const candidatesResult = ownDataProperty(root, 'candidates', '$.candidates', issues);
  if (candidatesResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.candidates',
      message: 'candidates is required',
    });
  }

  const candidatesArray = candidatesResult !== 'missing' && candidatesResult !== 'accessor'
    ? (candidatesResult as { kind: 'data'; value: unknown }).value
    : null;

  if (sourceIdsValid) {
    const candidatesValid = candidatesArray !== null && validateArrayDescriptor(candidatesArray, '$.candidates', issues);

    let candidatesList: MLBOfflineMultiCandidate[] = [];
    const candidateLoopIssuesBefore = issues.length;
    if (candidatesValid && Array.isArray(candidatesArray)) {
      const array = candidatesArray as unknown[];
      const seenCandidateIds = new Set<string>();
      const seenCombinationKeys = new Set<string>();
      const expectedCombinationKeys = new Set<string>();
      const n = validSourceIds.length;

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const ids = [validSourceIds[i], validSourceIds[j]].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
          expectedCombinationKeys.add(ids.join('|'));
        }
      }
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          for (let k = j + 1; k < n; k++) {
            const ids = [validSourceIds[i], validSourceIds[j], validSourceIds[k]].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
            expectedCombinationKeys.add(ids.join('|'));
          }
        }
      }

      let legDuplicateRecId = false;
      let legDuplicateGameId = false;
      for (let c = 0; c < array.length; c++) {
        const candidateValue = array[c];
        const candidatePrefix = `$.candidates[${c}]`;
        legDuplicateRecId = false;
        legDuplicateGameId = false;
        if (!isPlainObject(candidateValue)) {
          issues.push({
            code: 'NOT_PLAIN_OBJECT',
            path: candidatePrefix,
            message: 'Candidate must be a plain object',
          });
          continue;
        }

        const candidateRoot = candidateValue as Record<string, unknown>;
        validateObjectFields(candidateRoot, KNOWN_CANDIDATE_FIELDS, PROHIBITED_CANDIDATE_FIELDS, candidatePrefix, issues);

        const candidateIdResult = ownDataProperty(candidateRoot, 'candidateId', `${candidatePrefix}.candidateId`, issues);
        const legCountResult = ownDataProperty(candidateRoot, 'legCount', `${candidatePrefix}.legCount`, issues);
        const minConfidenceResult = ownDataProperty(candidateRoot, 'minimumLegConfidence', `${candidatePrefix}.minimumLegConfidence`, issues);
        const meanConfidenceResult = ownDataProperty(candidateRoot, 'meanLegConfidence', `${candidatePrefix}.meanLegConfidence`, issues);
        const maxUncertaintyResult = ownDataProperty(candidateRoot, 'maximumLegUncertainty', `${candidatePrefix}.maximumLegUncertainty`, issues);
        const legsResult = ownDataProperty(candidateRoot, 'legs', `${candidatePrefix}.legs`, issues);

        let candidateId: unknown | null = null;
        if (candidateIdResult !== 'missing' && candidateIdResult !== 'accessor') {
          candidateId = (candidateIdResult as { kind: 'data'; value: unknown }).value;
        }
        let legCount: unknown | null = null;
        if (legCountResult !== 'missing' && legCountResult !== 'accessor') {
          legCount = (legCountResult as { kind: 'data'; value: unknown }).value;
        }
        let minimumLegConfidence: unknown | null = null;
        if (minConfidenceResult !== 'missing' && minConfidenceResult !== 'accessor') {
          minimumLegConfidence = (minConfidenceResult as { kind: 'data'; value: unknown }).value;
        }
        let meanLegConfidence: unknown | null = null;
        if (meanConfidenceResult !== 'missing' && meanConfidenceResult !== 'accessor') {
          meanLegConfidence = (meanConfidenceResult as { kind: 'data'; value: unknown }).value;
        }
        let maximumLegUncertainty: unknown | null = null;
        if (maxUncertaintyResult !== 'missing' && maxUncertaintyResult !== 'accessor') {
          maximumLegUncertainty = (maxUncertaintyResult as { kind: 'data'; value: unknown }).value;
        }

        if (!isStrictNonEmptyTrimmedString(candidateId)) {
          issues.push({
            code: 'INVALID_STRING',
            path: `${candidatePrefix}.candidateId`,
            message: 'candidateId must be a valid identifier',
          });
        }

        if (typeof minimumLegConfidence !== 'number' || !Number.isFinite(minimumLegConfidence) || minimumLegConfidence < 0 || minimumLegConfidence > 1) {
          issues.push({
            code: 'MINIMUM_CONFIDENCE_MISMATCH',
            path: `${candidatePrefix}.minimumLegConfidence`,
            message: 'minimumLegConfidence must be a finite number in [0,1]',
          });
        }

        if (typeof meanLegConfidence !== 'number' || !Number.isFinite(meanLegConfidence) || meanLegConfidence < 0 || meanLegConfidence > 1) {
          issues.push({
            code: 'MEAN_CONFIDENCE_MISMATCH',
            path: `${candidatePrefix}.meanLegConfidence`,
            message: 'meanLegConfidence must be a finite number in [0,1]',
          });
        }

        if (typeof maximumLegUncertainty !== 'number' || !Number.isFinite(maximumLegUncertainty) || maximumLegUncertainty < 0 || maximumLegUncertainty > 1) {
          issues.push({
            code: 'MAXIMUM_UNCERTAINTY_MISMATCH',
            path: `${candidatePrefix}.maximumLegUncertainty`,
            message: 'maximumLegUncertainty must be a finite number in [0,1]',
          });
        }

        const legIssuesBefore = issues.length;

        let legsArray: MLBOfflineMultiCandidateLeg[] = [];
        let legsCount = 0;
        if (legsResult !== 'missing' && legsResult !== 'accessor') {
          const legsValue = (legsResult as { kind: 'data'; value: unknown }).value;
          if (Array.isArray(legsValue)) {
            legsArray = [];
            legsCount = legsValue.length;
            const legSpare = validateArrayDescriptor(legsValue, `${candidatePrefix}.legs`, issues);
            if (legSpare) {
              let legOrderMismatch = false;
              let legDuplicateRecId = false;
              let legDuplicateGameId = false;
              const seenLegRecIds = new Set<string>();
              const seenLegGameIds = new Set<string>();
              for (let l = 0; l < legsValue.length; l++) {
                const leg = validateLeg(legsValue[l], l, officialDate ?? '', sourceIdSet, issues);
                if (leg) {
                  if (seenLegRecIds.has(leg.recommendationId)) {
                    issues.push({
                      code: 'DUPLICATE_LEG_RECOMMENDATION_ID',
                      path: `${candidatePrefix}.legs[${l}].recommendationId`,
                      message: `Duplicate leg recommendationId: ${leg.recommendationId}`,
                    });
                    legDuplicateRecId = true;
                  } else {
                    seenLegRecIds.add(leg.recommendationId);
                    if (seenLegGameIds.has(leg.gameId)) {
                      issues.push({
                        code: 'DUPLICATE_LEG_GAME_ID',
                        path: `${candidatePrefix}.legs[${l}].gameId`,
                        message: `Duplicate leg gameId: ${leg.gameId}`,
                      });
                      legDuplicateGameId = true;
                    } else {
                      seenLegGameIds.add(leg.gameId);
                    }
                  }
                  legsArray.push(leg);
                }
              }

              if (!legOrderMismatch && !legDuplicateRecId && !legDuplicateGameId) {
                if (legsArray.length > 1 && !isCanonicalLegOrder(legsArray)) {
                  issues.push({
                    code: 'ORDER_MISMATCH',
                    path: `${candidatePrefix}.legs`,
                    message: 'Legs must be in canonical order',
                  });
                  legOrderMismatch = true;
                }
              }

              if (!legOrderMismatch && !legDuplicateRecId && !legDuplicateGameId) {
                if (typeof legCount !== 'number' || (legCount !== 2 && legCount !== 3)) {
                  issues.push({
                    code: 'LEG_COUNT_MISMATCH',
                    path: `${candidatePrefix}.legCount`,
                    message: 'legCount must be 2 or 3',
                  });
                } else if (legCount !== legsCount) {
                  issues.push({
                    code: 'LEG_COUNT_MISMATCH',
                    path: `${candidatePrefix}.legCount`,
                    message: 'legCount must equal legs.length',
                  });
                }
              }

              if (
                !legOrderMismatch &&
                !legDuplicateRecId &&
                !legDuplicateGameId &&
                typeof minimumLegConfidence === 'number' &&
                typeof meanLegConfidence === 'number' &&
                typeof maximumLegUncertainty === 'number' &&
                legsArray.length > 0
              ) {
                const actualMin = Math.min(...legsArray.map((l) => l.modelConfidence));
                const actualMean = legsArray.reduce((sum, l) => sum + l.modelConfidence, 0) / legsArray.length;
                const actualMax = Math.max(...legsArray.map((l) => l.modelUncertainty));
                if (actualMin !== minimumLegConfidence) {
                  issues.push({
                    code: 'MINIMUM_CONFIDENCE_MISMATCH',
                    path: `${candidatePrefix}.minimumLegConfidence`,
                    message: 'minimumLegConfidence does not match the minimum leg confidence',
                  });
                }
                if (actualMean !== meanLegConfidence) {
                  issues.push({
                    code: 'MEAN_CONFIDENCE_MISMATCH',
                    path: `${candidatePrefix}.meanLegConfidence`,
                    message: 'meanLegConfidence does not match the arithmetic mean of leg confidences',
                  });
                }
                if (actualMax !== maximumLegUncertainty) {
                  issues.push({
                    code: 'MAXIMUM_UNCERTAINTY_MISMATCH',
                    path: `${candidatePrefix}.maximumLegUncertainty`,
                    message: 'maximumLegUncertainty does not match the maximum leg uncertainty',
                  });
                }
              }
            }
          } else {
            issues.push({
              code: 'INVALID_ARRAY',
              path: `${candidatePrefix}.legs`,
              message: 'legs must be an array',
            });
          }
        } else {
          issues.push({
            code: 'MISSING_FIELD',
            path: `${candidatePrefix}.legs`,
            message: 'legs is required',
          });
        }

        const resolvedRecommendationSetId =
          recommendationSetIdResult !== 'missing' && recommendationSetIdResult !== 'accessor'
            ? (recommendationSetIdResult as { kind: 'data'; value: unknown }).value
            : null;
        if (issues.length === legIssuesBefore) {
          if (
            typeof candidateId === 'string' &&
            typeof recommendationSetId === 'string' &&
            typeof legCount === 'number' &&
            legCount === 2 &&
            legsArray.length === 2
          ) {
            const expectedId = candidateIdFor(
              {
                candidateId,
                legCount: 2,
                minimumLegConfidence: typeof minimumLegConfidence === 'number' ? minimumLegConfidence : 0,
                meanLegConfidence: typeof meanLegConfidence === 'number' ? meanLegConfidence : 0,
                maximumLegUncertainty: typeof maximumLegUncertainty === 'number' ? maximumLegUncertainty : 0,
                legs: legsArray,
              },
              recommendationSetId,
            );
            if (candidateId !== expectedId) {
              issues.push({
                code: 'CANDIDATE_ID_MISMATCH',
                path: `${candidatePrefix}.candidateId`,
                message: 'candidateId does not match the deterministic formula',
              });
            }
          }

          if (
            typeof candidateId === 'string' &&
            typeof recommendationSetId === 'string' &&
            typeof legCount === 'number' &&
            legCount === 3 &&
            legsArray.length === 3
          ) {
            const expectedId = candidateIdFor(
              {
                candidateId,
                legCount: 3,
                minimumLegConfidence: typeof minimumLegConfidence === 'number' ? minimumLegConfidence : 0,
                meanLegConfidence: typeof meanLegConfidence === 'number' ? meanLegConfidence : 0,
                maximumLegUncertainty: typeof maximumLegUncertainty === 'number' ? maximumLegUncertainty : 0,
                legs: legsArray,
              },
              recommendationSetId,
            );
            if (candidateId !== expectedId) {
              issues.push({
                code: 'CANDIDATE_ID_MISMATCH',
                path: `${candidatePrefix}.candidateId`,
                message: 'candidateId does not match the deterministic formula',
              });
            }
          }
        }

        if (typeof candidateId === 'string') {
          if (seenCandidateIds.has(candidateId)) {
            issues.push({
              code: 'DUPLICATE_CANDIDATE_ID',
              path: `${candidatePrefix}.candidateId`,
              message: `Duplicate candidateId: ${candidateId}`,
            });
          } else {
            seenCandidateIds.add(candidateId);
          }
        }

        const legIds = legsArray.map((l) => l.recommendationId).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
        const comboKey = legIds.join('|');
        if (seenCombinationKeys.has(comboKey)) {
          issues.push({
            code: 'DUPLICATE_CANDIDATE_ID',
            path: `${candidatePrefix}.candidateId`,
            message: `Duplicate candidateId: ${candidateId}`,
          });
        } else {
          seenCombinationKeys.add(comboKey);
        }

        for (const id of legIds) {
          if (!sourceIdSet.has(id)) {
            issues.push({
              code: 'CANDIDATE_INVALID',
              path: candidatePrefix,
              message: `Candidate contains unknown recommendationId: ${id}`,
            });
          }
        }
      }

      if (candidatesArray.length > 0 && !isCanonicalCandidateOrder(candidatesList)) {
        issues.push({
          code: 'ORDER_MISMATCH',
          path: '$.candidates',
          message: 'Candidates must be in canonical order',
        });
      }

      if (issues.length === candidateLoopIssuesBefore) {
        if (expectedCombinationKeys.size !== seenCombinationKeys.size) {
          issues.push({
            code: 'CANDIDATE_COMPLETENESS_MISMATCH',
            path: '$.candidates',
            message: 'Candidate completeness mismatch',
          });
        } else {
          for (const key of expectedCombinationKeys) {
            if (!seenCombinationKeys.has(key)) {
              issues.push({
                code: 'CANDIDATE_COMPLETENESS_MISMATCH',
                path: '$.candidates',
                message: 'Candidate completeness mismatch',
              });
              break;
            }
          }
        }

        if (
          candidateCountResult !== 'missing' &&
          candidateCountResult !== 'accessor' &&
          !legDuplicateRecId &&
          !legDuplicateGameId
        ) {
          const candidateCount = (candidateCountResult as { kind: 'data'; value: unknown }).value;
          const candidatesLength = Array.isArray(candidatesArray) ? candidatesArray.length : 0;
          const n = validSourceIds.length;
          const expectedCandidateCount = (n * (n - 1)) / 2 + (n * (n - 1) * (n - 2)) / 6;
          validateCandidateCount(candidateCount, candidatesLength, expectedCandidateCount, '$.candidateCount', issues);
        }
      }
    }
  }

  if (
    typeof candidateSetId === 'string' &&
    typeof recommendationSetId === 'string'
  ) {
    const expectedCandidateSetId = `${recommendationSetId}::offline-candidate-set-v1`;
    if (candidateSetId !== expectedCandidateSetId) {
      issues.push({
        code: 'CANDIDATE_SET_ID_MISMATCH',
        path: '$.candidateSetId',
        message: 'candidateSetId does not match the deterministic formula',
      });
    }
  }

  const finalIssues = normalizeIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: proposed as MLBOfflineMultiCandidateSet };
}

export function buildMLBOfflineMultiCandidateSet(
  input: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineMultiCandidateSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineMultiCandidateSetIssue[];
    }> {
  const sourceValidation = validateMLBOfflineSinglePickRecommendationSet(input);
  if (!sourceValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_RECOMMENDATION_SET_INVALID',
          path: '$.recommendationSet',
          message: 'Source recommendation set is invalid',
        },
      ]),
    };
  }

  const source = sourceValidation.value;
  const sourceRecommendationIds = source.recommendations
    .map((rec) => rec.recommendationId)
    .slice()
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const candidates: MLBOfflineMultiCandidate[] = [];
  const recommendations = source.recommendations;

  function createCandidate(
    legs: readonly MLBOfflineSinglePickRecommendation[],
  ): MLBOfflineMultiCandidate {
    function toLegCount(length: number): 2 | 3 {
      if (length !== 2 && length !== 3) {
        throw new Error('Invalid leg count');
      }
      return length;
    }

    const sortedLegs = legs.slice().sort((a, b) => {
      if (a.gameId < b.gameId) return -1;
      if (a.gameId > b.gameId) return 1;
      if (a.snapshotId < b.snapshotId) return -1;
      if (a.snapshotId > b.snapshotId) return 1;
      if (a.inferenceId < b.inferenceId) return -1;
      if (a.inferenceId > b.inferenceId) return 1;
      return 0;
    });

    const minimumLegConfidence = Math.min(...sortedLegs.map((l) => l.modelConfidence));
    const meanLegConfidence =
      sortedLegs.reduce((sum, l) => sum + l.modelConfidence, 0) / sortedLegs.length;
    const maximumLegUncertainty = Math.max(...sortedLegs.map((l) => l.modelUncertainty));

    const ids = sortedLegs
      .map((l) => l.recommendationId)
      .slice()
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const encoded = ids.map((id) => `${id.length}:${id}`).join('|');
    const candidateId = `${source.recommendationSetId}::${sortedLegs.length}::${encoded}::offline-candidate-v1`;

    return Object.freeze({
      candidateId,
      legCount: toLegCount(sortedLegs.length),
      minimumLegConfidence,
      meanLegConfidence,
      maximumLegUncertainty,
      legs: Object.freeze(sortedLegs) as readonly MLBOfflineMultiCandidateLeg[],
    });
  }

  for (let i = 0; i < recommendations.length; i++) {
    for (let j = i + 1; j < recommendations.length; j++) {
      candidates.push(createCandidate([recommendations[i], recommendations[j]]));
    }
  }

  for (let i = 0; i < recommendations.length; i++) {
    for (let j = i + 1; j < recommendations.length; j++) {
      for (let k = j + 1; k < recommendations.length; k++) {
        candidates.push(createCandidate([recommendations[i], recommendations[j], recommendations[k]]));
      }
    }
  }

  const sortedCandidates = candidates.slice().sort((a, b) => {
    if (a.minimumLegConfidence > b.minimumLegConfidence) return -1;
    if (a.minimumLegConfidence < b.minimumLegConfidence) return 1;
    if (a.meanLegConfidence > b.meanLegConfidence) return -1;
    if (a.meanLegConfidence < b.meanLegConfidence) return 1;
    if (a.legCount < b.legCount) return -1;
    if (a.legCount > b.legCount) return 1;
    if (a.candidateId < b.candidateId) return -1;
    if (a.candidateId > b.candidateId) return 1;
    return 0;
  });

  const candidateSetId = `${source.recommendationSetId}::offline-candidate-set-v1`;

  const root = Object.freeze({
    contractVersion: MLB_OFFLINE_MULTI_CANDIDATE_SET_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    candidateSetId,
    recommendationSetId: source.recommendationSetId,
    slateId: source.slateId,
    releaseId: source.releaseId,
    modelId: source.modelId,
    planId: source.planId,
    matrixId: source.matrixId,
    configId: source.configId,
    manifestId: source.manifestId,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    decisionPolicy: 'HOME_AT_OR_ABOVE_0_5_V1',
    officialDate: source.officialDate,
    sourceRecommendationPolicy: 'ALL_VALIDATED_PREDICTIONS_V1',
    candidatePolicy: MLB_OFFLINE_MULTI_CANDIDATE_POLICY,
    orderPolicy: MLB_OFFLINE_MULTI_CANDIDATE_ORDER_POLICY,
    sourceRecommendationCount: sourceRecommendationIds.length,
    sourceRecommendationIds: Object.freeze(sourceRecommendationIds) as readonly string[],
    candidateCount: sortedCandidates.length,
    candidates: Object.freeze(sortedCandidates) as readonly MLBOfflineMultiCandidate[],
  });

  const validation = validateMLBOfflineMultiCandidateSet(root);
  if (!validation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'GENERATED_CANDIDATE_SET_INVALID',
          path: '$',
          message: 'Generated candidate set failed validation',
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
