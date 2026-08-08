import { assertNoOddsContamination, isProhibitedOddsBoundaryKey } from '../firewall/odds-contamination-guard';
import {
  type MLBOfflineRecommendationBundle,
  validateMLBOfflineRecommendationBundle,
} from './mlb-offline-recommendation-bundle-contract';
import {
  type MLBOfflineOfficialFinalGameOutcomeSet,
  validateMLBOfflineOfficialFinalGameOutcomeSet,
} from './mlb-offline-official-final-game-outcome-set-contract';

type SourceSinglePickRecommendation =
  MLBOfflineRecommendationBundle['sourceSinglePickRecommendationSet']['recommendations'][number];

type SourceSelectedMultiRecommendation =
  MLBOfflineRecommendationBundle['sourceMultiRecommendationSet']['selectedRecommendations'][number];

type SourceOfficialOutcome =
  MLBOfflineOfficialFinalGameOutcomeSet['outcomes'][number];

export const MLB_OFFLINE_RECOMMENDATION_BUNDLE_GRADING_CONTRACT_VERSION =
  'mlb-offline-recommendation-bundle-grading-v1' as const;

export type MLBOfflineRecommendationBundleGradingInput = Readonly<{
  recommendationBundle: unknown;
  outcomeSet: unknown;
}>;

export type MLBOfflineSinglePickGrade = Readonly<{
  gradeId: string;
  recommendationId: string;
  gameId: string;
  officialDate: string;
  recommendedTeamId: string;
  result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
  outcomeId: string | null;
  winnerTeamId: string | null;
}>;

export type MLBOfflineMultiLegGrade = Readonly<{
  gradeId: string;
  recommendationId: string;
  gameId: string;
  officialDate: string;
  recommendedTeamId: string;
  result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
  outcomeId: string | null;
  winnerTeamId: string | null;
}>;

export type MLBOfflineMultiGrade = Readonly<{
  gradeId: string;
  candidateId: string;
  result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  legCount: number;
  resolvedLegCount: number;
  correctLegCount: number;
  incorrectLegCount: number;
  unresolvedLegCount: number;
  legGradeIds: readonly string[];
  legGrades: readonly MLBOfflineMultiLegGrade[];
}>;

export type MLBOfflineRecommendationBundleGrading = Readonly<{
  contractVersion: typeof MLB_OFFLINE_RECOMMENDATION_BUNDLE_GRADING_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  gradingId: string;
  recommendationBundleId: string;
  outcomeSetId: string;
  singlePickGradeCount: number;
  singlePickGradeIds: readonly string[];
  multiGradeCount: number;
  multiGradeIds: readonly string[];
  singlePickGrades: readonly MLBOfflineSinglePickGrade[];
  multiGrades: readonly MLBOfflineMultiGrade[];
  sourceRecommendationBundle: MLBOfflineRecommendationBundle;
  sourceOutcomeSet: MLBOfflineOfficialFinalGameOutcomeSet;
}>;

export type MLBOfflineRecommendationBundleGradingIssue = Readonly<{
  code:
    | 'NOT_PLAIN_OBJECT'
    | 'UNKNOWN_FIELD'
    | 'INVALID_JSON_VALUE'
    | 'ODDS_CONTAMINATION'
    | 'PROHIBITED_CONCEPT'
    | 'MISSING_FIELD'
    | 'INVALID_LITERAL'
    | 'INVALID_STRING'
    | 'INVALID_INTEGER'
    | 'INVALID_ARRAY'
    | 'SOURCE_RECOMMENDATION_BUNDLE_INVALID'
    | 'SOURCE_OUTCOME_SET_INVALID'
    | 'RECOMMENDATION_BUNDLE_ID_MISMATCH'
    | 'OUTCOME_SET_ID_MISMATCH'
    | 'SINGLE_PICK_GRADE_COUNT_MISMATCH'
    | 'SINGLE_PICK_GRADE_IDS_MISMATCH'
    | 'MULTI_GRADE_COUNT_MISMATCH'
    | 'MULTI_GRADE_IDS_MISMATCH'
    | 'OFFICIAL_DATE_MISMATCH'
    | 'COMPETITOR_IDENTITY_MISMATCH'
    | 'INVALID_TIMESTAMP_ELIGIBILITY'
    | 'SINGLE_PICK_GRADE_MAPPING_MISMATCH'
    | 'SINGLE_PICK_GRADE_RESULT_MISMATCH'
    | 'SINGLE_PICK_GRADE_ID_MISMATCH'
    | 'LEG_GRADE_COUNT_MISMATCH'
    | 'LEG_GRADE_IDS_MISMATCH'
    | 'LEG_GRADE_MAPPING_MISMATCH'
    | 'LEG_GRADE_RESULT_MISMATCH'
    | 'LEG_GRADE_ID_MISMATCH'
    | 'MULTI_GRADE_MAPPING_MISMATCH'
    | 'MULTI_GRADE_RESULT_MISMATCH'
    | 'MULTI_GRADE_ID_MISMATCH'
    | 'GRADING_ID_MISMATCH'
    | 'GENERATED_GRADING_INVALID';
  path: string;
  message: string;
}>;

const ROOT_FIELDS = [
  'contractVersion',
  'sport',
  'target',
  'gradingId',
  'recommendationBundleId',
  'outcomeSetId',
  'singlePickGradeCount',
  'singlePickGradeIds',
  'multiGradeCount',
  'multiGradeIds',
  'singlePickGrades',
  'multiGrades',
  'sourceRecommendationBundle',
  'sourceOutcomeSet',
] as const;

const BUILDER_ROOT_FIELDS = ['recommendationBundle', 'outcomeSet'] as const;

const PROHIBITED_ROOT_FIELDS = new Set([
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
  'feature',
  'missing',
  'coefficient',
  'intercept',
  'rawScore',
  'metric',
  'label',
  'row',
  'sportsbook',
  'performance',
  'aggregate',
  'yield',
  'roi',
  'bankroll',
  'payout',
  'profit',
]);

const SINGLE_PICK_GRADE_FIELDS = [
  'gradeId',
  'recommendationId',
  'gameId',
  'officialDate',
  'recommendedTeamId',
  'result',
  'eligibility',
  'outcomeId',
  'winnerTeamId',
] as const;

const MULTI_LEG_GRADE_FIELDS = [
  'gradeId',
  'recommendationId',
  'gameId',
  'officialDate',
  'recommendedTeamId',
  'result',
  'eligibility',
  'outcomeId',
  'winnerTeamId',
] as const;

const MULTI_GRADE_FIELDS = [
  'gradeId',
  'candidateId',
  'result',
  'legCount',
  'resolvedLegCount',
  'correctLegCount',
  'incorrectLegCount',
  'unresolvedLegCount',
  'legGradeIds',
  'legGrades',
] as const;

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
  issues: MLBOfflineRecommendationBundleGradingIssue[],
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
  issues: MLBOfflineRecommendationBundleGradingIssue[],
  issue: MLBOfflineRecommendationBundleGradingIssue,
): void {
  const exists = issues.some(
    (item) => item.path === issue.path && item.code === issue.code,
  );
  if (!exists) {
    issues.push(issue);
  }
}

function normalizeIssues(
  issues: readonly MLBOfflineRecommendationBundleGradingIssue[],
): readonly MLBOfflineRecommendationBundleGradingIssue[] {
  const seen = new Set<string>();
  const normalized: MLBOfflineRecommendationBundleGradingIssue[] = [];
  for (const issue of issues) {
    const key = `${issue.code}:${issue.path}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    normalized.push(issue);
  }
  return normalized;
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

const encodeComponent = (value: string): string => `${value.length}:${value}`;

function deterministicSinglePickGradeId(parts: {
  recommendationId: string;
  result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
  outcomeId: string | null;
  winnerTeamId: string | null;
}): string {
  return (
    encodeComponent(parts.recommendationId) +
    encodeComponent(parts.result) +
    encodeComponent(parts.eligibility) +
    encodeComponent(parts.outcomeId ?? 'NO_OUTCOME') +
    encodeComponent(parts.winnerTeamId ?? 'NO_WINNER') +
    '::offline-single-pick-grade-v1'
  );
}

function deterministicMultiLegGradeId(parts: {
  candidateId: string;
  recommendationId: string;
  result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
  outcomeId: string | null;
  winnerTeamId: string | null;
}): string {
  return (
    encodeComponent(parts.candidateId) +
    encodeComponent(parts.recommendationId) +
    encodeComponent(parts.result) +
    encodeComponent(parts.eligibility) +
    encodeComponent(parts.outcomeId ?? 'NO_OUTCOME') +
    encodeComponent(parts.winnerTeamId ?? 'NO_WINNER') +
    '::offline-multi-leg-grade-v1'
  );
}

function deterministicMultiGradeId(
  candidateId: string,
  result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED',
  legGradeIds: readonly string[],
): string {
  return (
    encodeComponent(candidateId) +
    encodeComponent(result) +
    encodeComponent(String(legGradeIds.length)) +
    legGradeIds.map((id) => encodeComponent(id)).join('') +
    '::offline-multi-grade-v1'
  );
}

function deterministicGradingId(
  recommendationBundleId: string,
  outcomeSetId: string,
  singlePickGradeIds: readonly string[],
  multiGradeIds: readonly string[],
): string {
  return (
    encodeComponent(recommendationBundleId) +
    encodeComponent(outcomeSetId) +
    encodeComponent(String(singlePickGradeIds.length)) +
    singlePickGradeIds.map((id) => encodeComponent(id)).join('') +
    encodeComponent(String(multiGradeIds.length)) +
    multiGradeIds.map((id) => encodeComponent(id)).join('') +
    '::offline-recommendation-bundle-grading-v1'
  );
}

function validateArrayDescriptor(
  value: unknown,
  prefix: string,
  issues: MLBOfflineRecommendationBundleGradingIssue[],
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
      if (PROHIBITED_ROOT_FIELDS.has(normalizedKey)) {
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

  for (const key of ownNames) {
    if (/^\d+$/.test(key)) {
      const indexDescriptor = Object.getOwnPropertyDescriptor(array, key);
      if (indexDescriptor && !isDataDescriptor(indexDescriptor)) {
        issues.push({
          code: 'INVALID_JSON_VALUE',
          path: `${prefix}[${key}]`,
          message: 'Accessor property',
        });
      }
    }
  }

  const hasAccessor = issues.some(
    (issue) => issue.code === 'INVALID_JSON_VALUE' && issue.path.startsWith(`${prefix}[`),
  );
  return !hasAccessor;
}

function validateBuilderRoot(
  proposed: unknown,
  issues: MLBOfflineRecommendationBundleGradingIssue[],
): proposed is Readonly<{ recommendationBundle: unknown; outcomeSet: unknown }> {
  if (!isPlainObject(proposed)) {
    pushUniqueIssue(issues, {
      code: 'NOT_PLAIN_OBJECT',
      path: '$',
      message: 'Root must be a plain object',
    });
    return false;
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
    if (!BUILDER_ROOT_FIELDS.includes(key as (typeof BUILDER_ROOT_FIELDS)[number])) {
      if (PROHIBITED_ROOT_FIELDS.has(key)) {
        if (isProhibitedOddsBoundaryKey(key)) {
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
    if (BUILDER_ROOT_FIELDS.includes(key as (typeof BUILDER_ROOT_FIELDS)[number])) {
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

  return true;
}

function buildSinglePickGrade(
  recommendation: SourceSinglePickRecommendation,
  index: number,
  recommendedAt: string,
  outcomeLookup: Map<string, SourceOfficialOutcome>,
  issues: MLBOfflineRecommendationBundleGradingIssue[],
): MLBOfflineSinglePickGrade | null {
  const recommendationPrefix =
    `$.recommendationBundle.sourceSinglePickRecommendationSet.recommendations[${index}]`;
  const gameId = recommendation.gameId;
  const outcome = outcomeLookup.get(gameId);

  let result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  let eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
  let outcomeId: string | null = null;
  let winnerTeamId: string | null = null;

  if (!outcome) {
    result = 'UNRESOLVED';
    eligibility = 'UNVERIFIED_MISSING_OUTCOME';
    outcomeId = null;
    winnerTeamId = null;
  } else {
    if (recommendation.officialDate !== outcome.officialDate) {
      issues.push({
        code: 'OFFICIAL_DATE_MISMATCH',
        path: `${recommendationPrefix}.officialDate`,
        message: `officialDate must match official outcome for game ${gameId}`,
      });
      return null;
    }

    if (recommendation.homeTeamId !== outcome.homeTeamId) {
      issues.push({
        code: 'COMPETITOR_IDENTITY_MISMATCH',
        path: `${recommendationPrefix}.homeTeamId`,
        message: `homeTeamId must match official outcome for game ${gameId}`,
      });
      return null;
    }

    if (recommendation.awayTeamId !== outcome.awayTeamId) {
      issues.push({
        code: 'COMPETITOR_IDENTITY_MISMATCH',
        path: `${recommendationPrefix}.awayTeamId`,
        message: `awayTeamId must match official outcome for game ${gameId}`,
      });
      return null;
    }

    if (recommendation.dataCutoffAt >= outcome.scheduledStartAt) {
      issues.push({
        code: 'INVALID_TIMESTAMP_ELIGIBILITY',
        path: `${recommendationPrefix}.dataCutoffAt`,
        message: `dataCutoffAt must be earlier than scheduledStartAt for game ${gameId}`,
      });
      return null;
    }

    if (recommendedAt >= outcome.scheduledStartAt) {
      issues.push({
        code: 'INVALID_TIMESTAMP_ELIGIBILITY',
        path: '$.recommendationBundle.recommendedAt',
        message: `recommendedAt must be earlier than scheduledStartAt for game ${gameId}`,
      });
      return null;
    }

    if (recommendation.recommendedTeamId === outcome.winnerTeamId) {
      result = 'CORRECT';
    } else {
      result = 'INCORRECT';
    }
    eligibility = 'VERIFIED_PRESTART';
    outcomeId = outcome.outcomeId;
    winnerTeamId = outcome.winnerTeamId;
  }

  const gradeId = deterministicSinglePickGradeId({
    recommendationId: recommendation.recommendationId,
    result,
    eligibility,
    outcomeId,
    winnerTeamId,
  });

  return Object.freeze({
    gradeId,
    recommendationId: recommendation.recommendationId,
    gameId: recommendation.gameId,
    officialDate: recommendation.officialDate,
    recommendedTeamId: recommendation.recommendedTeamId,
    result,
    eligibility,
    outcomeId,
    winnerTeamId,
  });
}

function buildMultiLegGrade(
  leg: SourceSinglePickRecommendation,
  selectedIndex: number,
  legIndex: number,
  candidateId: string,
  recommendedAt: string,
  outcomeLookup: Map<string, SourceOfficialOutcome>,
  issues: MLBOfflineRecommendationBundleGradingIssue[],
): MLBOfflineMultiLegGrade | null {
  const legPrefix =
    `$.recommendationBundle.sourceMultiRecommendationSet.selectedRecommendations[${selectedIndex}].legs[${legIndex}]`;
  const gameId = leg.gameId;
  const outcome = outcomeLookup.get(gameId);

  let result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  let eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
  let outcomeId: string | null = null;
  let winnerTeamId: string | null = null;

  if (!outcome) {
    result = 'UNRESOLVED';
    eligibility = 'UNVERIFIED_MISSING_OUTCOME';
    outcomeId = null;
    winnerTeamId = null;
  } else {
    if (leg.officialDate !== outcome.officialDate) {
      issues.push({
        code: 'OFFICIAL_DATE_MISMATCH',
        path: `${legPrefix}.officialDate`,
        message: `officialDate must match official outcome for game ${gameId}`,
      });
      return null;
    }

    if (leg.homeTeamId !== outcome.homeTeamId) {
      issues.push({
        code: 'COMPETITOR_IDENTITY_MISMATCH',
        path: `${legPrefix}.homeTeamId`,
        message: `homeTeamId must match official outcome for game ${gameId}`,
      });
      return null;
    }

    if (leg.awayTeamId !== outcome.awayTeamId) {
      issues.push({
        code: 'COMPETITOR_IDENTITY_MISMATCH',
        path: `${legPrefix}.awayTeamId`,
        message: `awayTeamId must match official outcome for game ${gameId}`,
      });
      return null;
    }

    if (leg.dataCutoffAt >= outcome.scheduledStartAt) {
      issues.push({
        code: 'INVALID_TIMESTAMP_ELIGIBILITY',
        path: `${legPrefix}.dataCutoffAt`,
        message: `dataCutoffAt must be earlier than scheduledStartAt for game ${gameId}`,
      });
      return null;
    }

    if (recommendedAt >= outcome.scheduledStartAt) {
      issues.push({
        code: 'INVALID_TIMESTAMP_ELIGIBILITY',
        path: '$.recommendationBundle.recommendedAt',
        message: `recommendedAt must be earlier than scheduledStartAt for game ${gameId}`,
      });
      return null;
    }

    if (leg.recommendedTeamId === outcome.winnerTeamId) {
      result = 'CORRECT';
    } else {
      result = 'INCORRECT';
    }
    eligibility = 'VERIFIED_PRESTART';
    outcomeId = outcome.outcomeId;
    winnerTeamId = outcome.winnerTeamId;
  }

  const gradeId = deterministicMultiLegGradeId({
    candidateId,
    recommendationId: leg.recommendationId,
    result,
    eligibility,
    outcomeId,
    winnerTeamId,
  });

  return Object.freeze({
    gradeId,
    recommendationId: leg.recommendationId,
    gameId: leg.gameId,
    officialDate: leg.officialDate,
    recommendedTeamId: leg.recommendedTeamId,
    result,
    eligibility,
    outcomeId,
    winnerTeamId,
  });
}

function buildMultiGrade(
  candidate: SourceSelectedMultiRecommendation,
  selectedIndex: number,
  legGrades: MLBOfflineMultiLegGrade[],
  issues: MLBOfflineRecommendationBundleGradingIssue[],
): MLBOfflineMultiGrade | null {
  const multiPrefix =
    `$.recommendationBundle.sourceMultiRecommendationSet.selectedRecommendations[${selectedIndex}]`;

  let correctLegCount = 0;
  let incorrectLegCount = 0;
  let unresolvedLegCount = 0;

  for (let l = 0; l < legGrades.length; l++) {
    const legGrade = legGrades[l];
    if (legGrade.result === 'CORRECT') {
      correctLegCount++;
    } else if (legGrade.result === 'INCORRECT') {
      incorrectLegCount++;
    } else {
      unresolvedLegCount++;
    }
  }

  let result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
  if (incorrectLegCount > 0) {
    result = 'INCORRECT';
  } else if (unresolvedLegCount > 0) {
    result = 'UNRESOLVED';
  } else {
    result = 'CORRECT';
  }

  const legGradeIds = legGrades.map((grade) => grade.gradeId);
  const resolvedLegCount = correctLegCount + incorrectLegCount;
  const legCount = legGrades.length;

  const gradeId = deterministicMultiGradeId(
    candidate.candidateId,
    result,
    legGradeIds,
  );

  return Object.freeze({
    gradeId,
    candidateId: candidate.candidateId,
    result,
    legCount,
    resolvedLegCount,
    correctLegCount,
    incorrectLegCount,
    unresolvedLegCount,
    legGradeIds,
    legGrades,
  });
}

function buildOutcomeLookup(
  outcomes: readonly SourceOfficialOutcome[],
): Map<string, SourceOfficialOutcome> {
  const lookup = new Map<string, SourceOfficialOutcome>();
  for (const outcome of outcomes) {
    lookup.set(outcome.gameId, outcome);
  }
  return lookup;
}

function validateOutcomeField(
  proposed: unknown,
  index: number,
  field: keyof SourceOfficialOutcome,
  expectedType: 'string' | 'number' | 'timestamp' | 'date' | 'integer',
  issues: MLBOfflineRecommendationBundleGradingIssue[],
): unknown {
  const prefix = `$.outcomes[${index}].${String(field)}`;
  const result = ownDataProperty(proposed as Record<string, unknown>, String(field), prefix, issues);
  if (result === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: prefix,
      message: `${String(field)} is required`,
    });
    return null;
  }
  if (result === 'accessor') {
    return null;
  }
  const value = (result as { kind: 'data'; value: unknown }).value;

  if (expectedType === 'string') {
    if (typeof value !== 'string' || !isStrictNonEmptyTrimmedString(value)) {
      issues.push({
        code: 'INVALID_STRING',
        path: prefix,
        message: `${String(field)} must be a valid identifier`,
      });
      return null;
    }
  } else if (expectedType === 'number') {
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      issues.push({
        code: 'INVALID_INTEGER',
        path: prefix,
        message: `${String(field)} must be a non-negative safe integer`,
      });
      return null;
    }
  } else if (expectedType === 'integer') {
    if (typeof value !== 'number' || !Number.isSafeInteger(value)) {
      issues.push({
        code: 'INVALID_INTEGER',
        path: prefix,
        message: `${String(field)} must be a safe integer`,
      });
      return null;
    }
  } else if (expectedType === 'date') {
    if (typeof value !== 'string' || !isValidGregorianDate(value)) {
      issues.push({
        code: 'INVALID_STRING',
        path: prefix,
        message: `${String(field)} must be a valid calendar date`,
      });
      return null;
    }
  } else if (expectedType === 'timestamp') {
    if (typeof value !== 'string' || !isValidRfc3339Timestamp(value)) {
      issues.push({
        code: 'INVALID_STRING',
        path: prefix,
        message: `${String(field)} must be a valid RFC3339 timestamp`,
      });
      return null;
  }
  }

  return value;
}

function validateSourceObject(
  proposed: unknown,
  index: number,
  issues: MLBOfflineRecommendationBundleGradingIssue[],
): { sourceName: string; sourceRecordId: string; fetchedAt: string } | null {
  const prefix = `$.outcomes[${index}].source`;
  if (!isPlainObject(proposed)) {
    issues.push({
      code: 'INVALID_JSON_VALUE',
      path: prefix,
      message: 'source must be a plain object',
    });
    return null;
  }

  const root = proposed as Record<string, unknown>;
  const sourceNameResult = ownDataProperty(root, 'sourceName', `${prefix}.sourceName`, issues);
  const sourceRecordIdResult = ownDataProperty(root, 'sourceRecordId', `${prefix}.sourceRecordId`, issues);
  const fetchedAtResult = ownDataProperty(root, 'fetchedAt', `${prefix}.fetchedAt`, issues);

  let sourceName: string | null = null;
  let sourceRecordId: string | null = null;
  let fetchedAt: string | null = null;

  if (sourceNameResult !== 'missing' && sourceNameResult !== 'accessor') {
    const value = (sourceNameResult as { kind: 'data'; value: unknown }).value;
    if (typeof value === 'string' && isStrictNonEmptyTrimmedString(value)) {
      sourceName = value;
    } else {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.sourceName`,
        message: 'sourceName must be a valid identifier',
      });
    }
  } else if (sourceNameResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.sourceName`,
      message: 'sourceName is required',
    });
  }

  if (sourceRecordIdResult !== 'missing' && sourceRecordIdResult !== 'accessor') {
    const value = (sourceRecordIdResult as { kind: 'data'; value: unknown }).value;
    if (typeof value === 'string' && isStrictNonEmptyTrimmedString(value)) {
      sourceRecordId = value;
    } else {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.sourceRecordId`,
        message: 'sourceRecordId must be a valid identifier',
      });
    }
  } else if (sourceRecordIdResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.sourceRecordId`,
      message: 'sourceRecordId is required',
    });
  }

  if (fetchedAtResult !== 'missing' && fetchedAtResult !== 'accessor') {
    const value = (fetchedAtResult as { kind: 'data'; value: unknown }).value;
    if (typeof value === 'string' && isValidRfc3339Timestamp(value)) {
      fetchedAt = value;
    } else {
      issues.push({
        code: 'INVALID_STRING',
        path: `${prefix}.fetchedAt`,
        message: 'fetchedAt must be a valid RFC3339 timestamp',
      });
    }
  } else if (fetchedAtResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: `${prefix}.fetchedAt`,
      message: 'fetchedAt is required',
    });
  }

  if (!sourceName || !sourceRecordId || !fetchedAt) {
    return null;
  }

  return { sourceName, sourceRecordId, fetchedAt };
}

export function validateMLBOfflineRecommendationBundleGrading(
  proposed: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineRecommendationBundleGrading;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineRecommendationBundleGradingIssue[];
    }> {
  const issues: MLBOfflineRecommendationBundleGradingIssue[] = [];

  if (!isPlainObject(proposed)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Root must be a plain object' },
      ]),
    };
  }

  const proposedRoot = proposed as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(proposedRoot)) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `$[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const key of Object.getOwnPropertyNames(proposedRoot)) {
    if (ROOT_FIELDS.includes(key as (typeof ROOT_FIELDS)[number])) {
      const descriptor = Object.getOwnPropertyDescriptor(proposedRoot, key);
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_JSON_VALUE',
          path: `$.${key}`,
          message: `Accessor property: ${key}`,
        });
      }
    }
  }

  const prohibitedKeys = new Set<string>();
  for (const key of Object.getOwnPropertyNames(proposedRoot)) {
    if (isProhibitedOddsBoundaryKey(key)) {
      pushUniqueIssue(issues, {
        code: 'ODDS_CONTAMINATION',
        path: `$.${key}`,
        message: 'Odds contamination detected',
      });
      prohibitedKeys.add(key);
    }
  }

  try {
    assertNoOddsContamination(proposedRoot);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ODDS_CONTAMINATION')) {
      pushUniqueIssue(issues, {
        code: 'ODDS_CONTAMINATION',
        path: '$',
        message: 'Odds contamination detected',
      });
    } else {
      return {
        ok: false,
        issues: normalizeIssues([
          { code: 'INVALID_JSON_VALUE', path: '$', message: 'Uninspectable accessor property' },
        ]),
      };
    }
  }

  for (const key of Object.getOwnPropertyNames(proposedRoot)) {
    if (ROOT_FIELDS.includes(key as (typeof ROOT_FIELDS)[number])) {
      continue;
    }
    if (prohibitedKeys.has(key)) {
      continue;
    }
    if (PROHIBITED_ROOT_FIELDS.has(key)) {
      pushUniqueIssue(issues, {
        code: 'PROHIBITED_CONCEPT',
        path: `$.${key}`,
        message: `Prohibited field: ${key}`,
      });
      continue;
    }
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `$.${key}`,
      message: `Unknown field: ${key}`,
    });
  }

  const contractVersionResult = ownDataProperty(proposedRoot, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.contractVersion',
      message: 'contractVersion is required',
    });
  } else if (contractVersionResult !== 'accessor') {
    const value = (contractVersionResult as { kind: 'data'; value: unknown }).value;
    if (value !== MLB_OFFLINE_RECOMMENDATION_BUNDLE_GRADING_CONTRACT_VERSION) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.contractVersion',
        message: `contractVersion must be ${MLB_OFFLINE_RECOMMENDATION_BUNDLE_GRADING_CONTRACT_VERSION}`,
      });
    }
  }

  const sportResult = ownDataProperty(proposedRoot, 'sport', '$.sport', issues);
  if (sportResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sport',
      message: 'sport is required',
    });
  } else if (sportResult !== 'accessor') {
    const value = (sportResult as { kind: 'data'; value: unknown }).value;
    if (value !== 'MLB') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.sport',
        message: 'sport must be MLB',
      });
    }
  }

  const targetResult = ownDataProperty(proposedRoot, 'target', '$.target', issues);
  if (targetResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.target',
      message: 'target is required',
    });
  } else if (targetResult !== 'accessor') {
    const value = (targetResult as { kind: 'data'; value: unknown }).value;
    if (value !== 'OFFICIAL_FINAL_GAME_WINNER') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.target',
        message: 'target must be OFFICIAL_FINAL_GAME_WINNER',
      });
    }
  }

  const gradingIdResult = ownDataProperty(proposedRoot, 'gradingId', '$.gradingId', issues);
  if (gradingIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.gradingId',
      message: 'gradingId is required',
    });
  } else if (gradingIdResult !== 'accessor') {
    const value = (gradingIdResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'string' || !isStrictNonEmptyTrimmedString(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.gradingId',
        message: 'gradingId must be a valid identifier',
      });
    }
  }

  const recommendationBundleIdResult = ownDataProperty(proposedRoot, 'recommendationBundleId', '$.recommendationBundleId', issues);
  if (recommendationBundleIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.recommendationBundleId',
      message: 'recommendationBundleId is required',
    });
  } else if (recommendationBundleIdResult !== 'accessor') {
    const value = (recommendationBundleIdResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'string' || !isStrictNonEmptyTrimmedString(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.recommendationBundleId',
        message: 'recommendationBundleId must be a valid identifier',
      });
    }
  }

  const outcomeSetIdResult = ownDataProperty(proposedRoot, 'outcomeSetId', '$.outcomeSetId', issues);
  if (outcomeSetIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.outcomeSetId',
      message: 'outcomeSetId is required',
    });
  } else if (outcomeSetIdResult !== 'accessor') {
    const value = (outcomeSetIdResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'string' || !isStrictNonEmptyTrimmedString(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.outcomeSetId',
        message: 'outcomeSetId must be a valid identifier',
      });
    }
  }

  const singlePickGradeCountResult = ownDataProperty(proposedRoot, 'singlePickGradeCount', '$.singlePickGradeCount', issues);
  if (singlePickGradeCountResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.singlePickGradeCount',
      message: 'singlePickGradeCount is required',
    });
  } else if (singlePickGradeCountResult !== 'accessor') {
    const value = (singlePickGradeCountResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      pushUniqueIssue(issues, {
        code: 'INVALID_INTEGER',
        path: '$.singlePickGradeCount',
        message: 'singlePickGradeCount must be a non-negative safe integer',
      });
    }
  }

  const multiGradeCountResult = ownDataProperty(proposedRoot, 'multiGradeCount', '$.multiGradeCount', issues);
  if (multiGradeCountResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.multiGradeCount',
      message: 'multiGradeCount is required',
    });
  } else if (multiGradeCountResult !== 'accessor') {
    const value = (multiGradeCountResult as { kind: 'data'; value: unknown }).value;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
      pushUniqueIssue(issues, {
        code: 'INVALID_INTEGER',
        path: '$.multiGradeCount',
        message: 'multiGradeCount must be a non-negative safe integer',
      });
    }
  }

  const singlePickGradeIdsResult = ownDataProperty(proposedRoot, 'singlePickGradeIds', '$.singlePickGradeIds', issues);
  let singlePickGradeIdsValid = true;
  let singlePickGradeIds: readonly string[] = [];
  if (singlePickGradeIdsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.singlePickGradeIds',
      message: 'singlePickGradeIds is required',
    });
    singlePickGradeIdsValid = false;
  } else if (singlePickGradeIdsResult !== 'accessor') {
    const value = (singlePickGradeIdsResult as { kind: 'data'; value: unknown }).value;
    if (!validateArrayDescriptor(value, '$.singlePickGradeIds', issues)) {
      singlePickGradeIdsValid = false;
    } else {
      const array = value as unknown[];
      const ids: string[] = [];
      for (let i = 0; i < array.length; i++) {
        const item = array[i];
        if (typeof item !== 'string' || !isStrictNonEmptyTrimmedString(item)) {
          issues.push({
            code: 'INVALID_STRING',
            path: `$.singlePickGradeIds[${i}]`,
            message: 'singlePickGradeIds must be valid identifiers',
          });
          singlePickGradeIdsValid = false;
          break;
        }
        ids.push(item);
      }
      singlePickGradeIds = ids;
    }
  } else {
    singlePickGradeIdsValid = false;
  }

  const multiGradeIdsResult = ownDataProperty(proposedRoot, 'multiGradeIds', '$.multiGradeIds', issues);
  let multiGradeIdsValid = true;
  let multiGradeIds: readonly string[] = [];
  if (multiGradeIdsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.multiGradeIds',
      message: 'multiGradeIds is required',
    });
    multiGradeIdsValid = false;
  } else if (multiGradeIdsResult !== 'accessor') {
    const value = (multiGradeIdsResult as { kind: 'data'; value: unknown }).value;
    if (!validateArrayDescriptor(value, '$.multiGradeIds', issues)) {
      multiGradeIdsValid = false;
    } else {
      const array = value as unknown[];
      const ids: string[] = [];
      for (let i = 0; i < array.length; i++) {
        const item = array[i];
        if (typeof item !== 'string' || !isStrictNonEmptyTrimmedString(item)) {
          issues.push({
            code: 'INVALID_STRING',
            path: `$.multiGradeIds[${i}]`,
            message: 'multiGradeIds must be valid identifiers',
          });
          multiGradeIdsValid = false;
          break;
        }
        ids.push(item);
      }
      multiGradeIds = ids;
    }
  } else {
    multiGradeIdsValid = false;
  }

  const singlePickGradesResult = ownDataProperty(proposedRoot, 'singlePickGrades', '$.singlePickGrades', issues);
  let singlePickGradesValid = true;
  let singlePickGrades: MLBOfflineSinglePickGrade[] = [];
  if (singlePickGradesResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.singlePickGrades',
      message: 'singlePickGrades is required',
    });
    singlePickGradesValid = false;
  } else if (singlePickGradesResult !== 'accessor') {
    const value = (singlePickGradesResult as { kind: 'data'; value: unknown }).value;
    if (!validateArrayDescriptor(value, '$.singlePickGrades', issues)) {
      singlePickGradesValid = false;
    } else {
      const array = value as unknown[];
      const grades: MLBOfflineSinglePickGrade[] = [];
      for (let i = 0; i < array.length; i++) {
        const item = array[i];
        if (!isPlainObject(item)) {
          issues.push({
            code: 'NOT_PLAIN_OBJECT',
            path: `$.singlePickGrades[${i}]`,
            message: 'Single-pick grade must be a plain object',
          });
          singlePickGradesValid = false;
          break;
        }
        const gradeRoot = item as Record<string, unknown>;
        for (const symbol of Object.getOwnPropertySymbols(gradeRoot)) {
          pushUniqueIssue(issues, {
            code: 'UNKNOWN_FIELD',
            path: `$.singlePickGrades[${i}][${String(symbol)}]`,
            message: 'Unknown symbol property',
          });
        }
        for (const key of Object.getOwnPropertyNames(gradeRoot)) {
          if (!SINGLE_PICK_GRADE_FIELDS.includes(key as (typeof SINGLE_PICK_GRADE_FIELDS)[number])) {
            pushUniqueIssue(issues, {
              code: 'UNKNOWN_FIELD',
              path: `$.singlePickGrades[${i}].${key}`,
              message: `Unknown field: ${key}`,
            });
          }
        }
        for (const key of Object.getOwnPropertyNames(gradeRoot)) {
          if (SINGLE_PICK_GRADE_FIELDS.includes(key as (typeof SINGLE_PICK_GRADE_FIELDS)[number])) {
            const descriptor = Object.getOwnPropertyDescriptor(gradeRoot, key);
            if (descriptor && !isDataDescriptor(descriptor)) {
              pushUniqueIssue(issues, {
                code: 'INVALID_JSON_VALUE',
                path: `$.singlePickGrades[${i}].${key}`,
                message: 'Accessor property',
              });
            }
          }
        }
        grades.push(item as MLBOfflineSinglePickGrade);
      }
      singlePickGrades = grades;
    }
  } else {
    singlePickGradesValid = false;
  }

  const multiGradesResult = ownDataProperty(proposedRoot, 'multiGrades', '$.multiGrades', issues);
  let multiGradesValid = true;
  let multiGrades: MLBOfflineMultiGrade[] = [];
  if (multiGradesResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.multiGrades',
      message: 'multiGrades is required',
    });
    multiGradesValid = false;
  } else if (multiGradesResult !== 'accessor') {
    const value = (multiGradesResult as { kind: 'data'; value: unknown }).value;
    if (!validateArrayDescriptor(value, '$.multiGrades', issues)) {
      multiGradesValid = false;
    } else {
      const array = value as unknown[];
      const grades: MLBOfflineMultiGrade[] = [];
      for (let i = 0; i < array.length; i++) {
        const item = array[i];
        if (!isPlainObject(item)) {
          issues.push({
            code: 'NOT_PLAIN_OBJECT',
            path: `$.multiGrades[${i}]`,
            message: 'Multi grade must be a plain object',
          });
          multiGradesValid = false;
          break;
        }
        const gradeRoot = item as Record<string, unknown>;
        for (const symbol of Object.getOwnPropertySymbols(gradeRoot)) {
          pushUniqueIssue(issues, {
            code: 'UNKNOWN_FIELD',
            path: `$.multiGrades[${i}][${String(symbol)}]`,
            message: 'Unknown symbol property',
          });
        }
        for (const key of Object.getOwnPropertyNames(gradeRoot)) {
          if (!MULTI_GRADE_FIELDS.includes(key as (typeof MULTI_GRADE_FIELDS)[number])) {
            pushUniqueIssue(issues, {
              code: 'UNKNOWN_FIELD',
              path: `$.multiGrades[${i}].${key}`,
              message: `Unknown field: ${key}`,
            });
          }
        }
        for (const key of Object.getOwnPropertyNames(gradeRoot)) {
          if (MULTI_GRADE_FIELDS.includes(key as (typeof MULTI_GRADE_FIELDS)[number])) {
            const descriptor = Object.getOwnPropertyDescriptor(gradeRoot, key);
            if (descriptor && !isDataDescriptor(descriptor)) {
              pushUniqueIssue(issues, {
                code: 'INVALID_JSON_VALUE',
                path: `$.multiGrades[${i}].${key}`,
                message: 'Accessor property',
              });
            }
          }
        }
        grades.push(item as MLBOfflineMultiGrade);
      }
      multiGrades = grades;
    }
  } else {
    multiGradesValid = false;
  }

  const sourceRecommendationBundleResult = ownDataProperty(
    proposedRoot,
    'sourceRecommendationBundle',
    '$.sourceRecommendationBundle',
    issues,
  );
  if (sourceRecommendationBundleResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sourceRecommendationBundle',
      message: 'sourceRecommendationBundle is required',
    });
  } else if (sourceRecommendationBundleResult !== 'accessor') {
    const sourceRecommendationBundleValidation = validateMLBOfflineRecommendationBundle(
      (sourceRecommendationBundleResult as { kind: 'data'; value: unknown }).value,
    );
    if (!sourceRecommendationBundleValidation.ok) {
      issues.push({
        code: 'SOURCE_RECOMMENDATION_BUNDLE_INVALID',
        path: '$.sourceRecommendationBundle',
        message: 'sourceRecommendationBundle failed validation',
      });
    }
  }

  const sourceOutcomeSetResult = ownDataProperty(proposedRoot, 'sourceOutcomeSet', '$.sourceOutcomeSet', issues);
  if (sourceOutcomeSetResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sourceOutcomeSet',
      message: 'sourceOutcomeSet is required',
    });
  } else if (sourceOutcomeSetResult !== 'accessor') {
    const sourceOutcomeSetValidation = validateMLBOfflineOfficialFinalGameOutcomeSet(
      (sourceOutcomeSetResult as { kind: 'data'; value: unknown }).value,
    );
    if (!sourceOutcomeSetValidation.ok) {
      issues.push({
        code: 'SOURCE_OUTCOME_SET_INVALID',
        path: '$.sourceOutcomeSet',
        message: 'sourceOutcomeSet failed validation',
      });
    }
  }

  const finalIssues = normalizeIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  const sourceRecommendationBundle = (sourceRecommendationBundleResult as { kind: 'data'; value: MLBOfflineRecommendationBundle }).value;
  const sourceOutcomeSet = (sourceOutcomeSetResult as { kind: 'data'; value: MLBOfflineOfficialFinalGameOutcomeSet }).value;

  const outcomeLookup = buildOutcomeLookup(sourceOutcomeSet.outcomes);

  const expectedRecommendationBundleId = sourceRecommendationBundle.recommendationBundleId;
  const expectedOutcomeSetId = sourceOutcomeSet.outcomeSetId;
  const expectedSinglePickCount = sourceRecommendationBundle.sourceSinglePickRecommendationSet.recommendations.length;
  const expectedMultiCount = sourceRecommendationBundle.sourceMultiRecommendationSet.selectedRecommendations.length;

  const rootIssues: MLBOfflineRecommendationBundleGradingIssue[] = [];

  const recommendedAt = sourceRecommendationBundle.recommendedAt;

  const proposedRecommendationBundleIdResult = ownDataProperty(proposedRoot, 'recommendationBundleId', '$.recommendationBundleId', rootIssues);
  const proposedRecommendationBundleId = (proposedRecommendationBundleIdResult as { kind: 'data'; value: string } | null)?.value ?? null;
  const proposedOutcomeSetIdResult = ownDataProperty(proposedRoot, 'outcomeSetId', '$.outcomeSetId', rootIssues);
  const proposedOutcomeSetId = (proposedOutcomeSetIdResult as { kind: 'data'; value: string } | null)?.value ?? null;

  if (proposedRecommendationBundleId !== expectedRecommendationBundleId) {
    rootIssues.push({
      code: 'RECOMMENDATION_BUNDLE_ID_MISMATCH',
      path: '$.recommendationBundleId',
      message: 'recommendationBundleId must match sourceRecommendationBundle',
    });
  }

  if (proposedOutcomeSetId !== expectedOutcomeSetId) {
    rootIssues.push({
      code: 'OUTCOME_SET_ID_MISMATCH',
      path: '$.outcomeSetId',
      message: 'outcomeSetId must match sourceOutcomeSet',
    });
  }

  const proposedSinglePickGradeCount = (singlePickGradeCountResult as { kind: 'data'; value: number } | null)?.value;
  if (typeof proposedSinglePickGradeCount === 'number' && proposedSinglePickGradeCount !== expectedSinglePickCount) {
    rootIssues.push({
      code: 'SINGLE_PICK_GRADE_COUNT_MISMATCH',
      path: '$.singlePickGradeCount',
      message: 'singlePickGradeCount must match source recommendation count',
    });
  }

  const proposedMultiGradeCount = (multiGradeCountResult as { kind: 'data'; value: number } | null)?.value;
  if (typeof proposedMultiGradeCount === 'number' && proposedMultiGradeCount !== expectedMultiCount) {
    rootIssues.push({
      code: 'MULTI_GRADE_COUNT_MISMATCH',
      path: '$.multiGradeCount',
      message: 'multiGradeCount must match source selected recommendation count',
    });
  }

  if (singlePickGradesValid && singlePickGrades.length !== expectedSinglePickCount) {
    rootIssues.push({
      code: 'SINGLE_PICK_GRADE_COUNT_MISMATCH',
      path: '$.singlePickGrades',
      message: 'singlePickGrades length must match source recommendation count',
    });
  }

  if (multiGradesValid && typeof proposedMultiGradeCount === 'number' && multiGrades.length !== proposedMultiGradeCount) {
    rootIssues.push({
      code: 'MULTI_GRADE_COUNT_MISMATCH',
      path: '$.multiGrades',
      message: 'multiGrades length must match source selected recommendation count',
    });
  }

  if (singlePickGradesValid && singlePickGradeIdsValid) {
    const expectedSinglePickGradeIds = singlePickGrades.map((grade) => grade.gradeId);
    if (singlePickGradeIds.length !== expectedSinglePickGradeIds.length || !singlePickGradeIds.every((id, i) => id === expectedSinglePickGradeIds[i])) {
      rootIssues.push({
        code: 'SINGLE_PICK_GRADE_IDS_MISMATCH',
        path: '$.singlePickGradeIds',
        message: 'singlePickGradeIds must match singlePickGrades gradeId order',
      });
    }
  }

  if (multiGradesValid && multiGradeIdsValid) {
    const expectedMultiGradeIds = multiGrades.map((grade) => grade.gradeId);
    if (multiGradeIds.length !== expectedMultiGradeIds.length || !multiGradeIds.every((id, i) => id === expectedMultiGradeIds[i])) {
      rootIssues.push({
        code: 'MULTI_GRADE_IDS_MISMATCH',
        path: '$.multiGradeIds',
        message: 'multiGradeIds must match multiGrades gradeId order',
      });
    }
  }

  const expectedSinglePickGrades: MLBOfflineSinglePickGrade[] = [];
  for (let i = 0; i < sourceRecommendationBundle.sourceSinglePickRecommendationSet.recommendations.length; i++) {
    const recommendation = sourceRecommendationBundle.sourceSinglePickRecommendationSet.recommendations[i];
    const outcome = outcomeLookup.get(recommendation.gameId);

    let result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
    let eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
    let outcomeId: string | null = null;
    let winnerTeamId: string | null = null;

    if (!outcome) {
      result = 'UNRESOLVED';
      eligibility = 'UNVERIFIED_MISSING_OUTCOME';
    } else {
      if (
        recommendation.officialDate !== outcome.officialDate ||
        recommendation.homeTeamId !== outcome.homeTeamId ||
        recommendation.awayTeamId !== outcome.awayTeamId ||
        recommendation.dataCutoffAt >= outcome.scheduledStartAt ||
        recommendedAt >= outcome.scheduledStartAt
      ) {
        result = 'UNRESOLVED';
        eligibility = 'UNVERIFIED_MISSING_OUTCOME';
      } else {
        result = recommendation.recommendedTeamId === outcome.winnerTeamId ? 'CORRECT' : 'INCORRECT';
        eligibility = 'VERIFIED_PRESTART';
        outcomeId = outcome.outcomeId;
        winnerTeamId = outcome.winnerTeamId;
      }
    }

    const gradeId = deterministicSinglePickGradeId({
      recommendationId: recommendation.recommendationId,
      result,
      eligibility,
      outcomeId,
      winnerTeamId,
    });

    expectedSinglePickGrades.push({
      gradeId,
      recommendationId: recommendation.recommendationId,
      gameId: recommendation.gameId,
      officialDate: recommendation.officialDate,
      recommendedTeamId: recommendation.recommendedTeamId,
      result,
      eligibility,
      outcomeId,
      winnerTeamId,
    });
  }

  if (singlePickGradesValid && typeof proposedSinglePickGradeCount === 'number' && singlePickGrades.length === proposedSinglePickGradeCount) {
    for (let i = 0; i < singlePickGrades.length; i++) {
      const proposed = singlePickGrades[i];
      const expected = expectedSinglePickGrades[i];
      const prefix = `$.singlePickGrades[${i}]`;

      if (proposed.recommendationId !== expected.recommendationId) {
        rootIssues.push({
          code: 'SINGLE_PICK_GRADE_MAPPING_MISMATCH',
          path: `${prefix}.recommendationId`,
          message: 'recommendationId must match source single-pick recommendation',
        });
      }
      if (proposed.gameId !== expected.gameId) {
        rootIssues.push({
          code: 'SINGLE_PICK_GRADE_MAPPING_MISMATCH',
          path: `${prefix}.gameId`,
          message: 'gameId must match source single-pick recommendation',
        });
      }
      if (proposed.recommendedTeamId !== expected.recommendedTeamId) {
        rootIssues.push({
          code: 'SINGLE_PICK_GRADE_MAPPING_MISMATCH',
          path: `${prefix}.recommendedTeamId`,
          message: 'recommendedTeamId must match source single-pick recommendation',
        });
      }
      if (proposed.result !== expected.result) {
        rootIssues.push({
          code: 'SINGLE_PICK_GRADE_RESULT_MISMATCH',
          path: `${prefix}.result`,
          message: 'result must match deterministic single-pick grading result',
        });
      }
      if (proposed.gradeId !== expected.gradeId) {
        rootIssues.push({
          code: 'SINGLE_PICK_GRADE_ID_MISMATCH',
          path: `${prefix}.gradeId`,
          message: 'gradeId must match deterministic single-pick grade identity',
        });
      }
    }
  }

  const expectedMultiGrades: MLBOfflineMultiGrade[] = [];
  for (let m = 0; m < sourceRecommendationBundle.sourceMultiRecommendationSet.selectedRecommendations.length; m++) {
    const candidate = sourceRecommendationBundle.sourceMultiRecommendationSet.selectedRecommendations[m];
    const legGrades: MLBOfflineMultiLegGrade[] = [];

    for (let l = 0; l < candidate.legs.length; l++) {
      const leg = candidate.legs[l];
      const outcome = outcomeLookup.get(leg.gameId);

      let result: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
      let eligibility: 'VERIFIED_PRESTART' | 'UNVERIFIED_MISSING_OUTCOME';
      let outcomeId: string | null = null;
      let winnerTeamId: string | null = null;

      if (!outcome) {
        result = 'UNRESOLVED';
        eligibility = 'UNVERIFIED_MISSING_OUTCOME';
      } else {
        if (
          leg.officialDate !== outcome.officialDate ||
          leg.homeTeamId !== outcome.homeTeamId ||
          leg.awayTeamId !== outcome.awayTeamId ||
          leg.dataCutoffAt >= outcome.scheduledStartAt ||
          recommendedAt >= outcome.scheduledStartAt
        ) {
          result = 'UNRESOLVED';
          eligibility = 'UNVERIFIED_MISSING_OUTCOME';
        } else {
          result = leg.recommendedTeamId === outcome.winnerTeamId ? 'CORRECT' : 'INCORRECT';
          eligibility = 'VERIFIED_PRESTART';
          outcomeId = outcome.outcomeId;
          winnerTeamId = outcome.winnerTeamId;
        }
      }

      const gradeId = deterministicMultiLegGradeId({
        candidateId: candidate.candidateId,
        recommendationId: leg.recommendationId,
        result,
        eligibility,
        outcomeId,
        winnerTeamId,
      });

      legGrades.push({
        gradeId,
        recommendationId: leg.recommendationId,
        gameId: leg.gameId,
        officialDate: leg.officialDate,
        recommendedTeamId: leg.recommendedTeamId,
        result,
        eligibility,
        outcomeId,
        winnerTeamId,
      });
    }

    let correctLegCount = 0;
    let incorrectLegCount = 0;
    let unresolvedLegCount = 0;
    for (const legGrade of legGrades) {
      if (legGrade.result === 'CORRECT') {
        correctLegCount++;
      } else if (legGrade.result === 'INCORRECT') {
        incorrectLegCount++;
      } else {
        unresolvedLegCount++;
      }
    }

    let multiResult: 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';
    if (incorrectLegCount > 0) {
      multiResult = 'INCORRECT';
    } else if (unresolvedLegCount > 0) {
      multiResult = 'UNRESOLVED';
    } else {
      multiResult = 'CORRECT';
    }

    const resolvedLegCount = correctLegCount + incorrectLegCount;
    const legGradeIds = legGrades.map((grade) => grade.gradeId);
    const gradeId = deterministicMultiGradeId(
      candidate.candidateId,
      multiResult,
      legGradeIds,
    );

    expectedMultiGrades.push({
      gradeId,
      candidateId: candidate.candidateId,
      result: multiResult,
      legCount: legGrades.length,
      resolvedLegCount,
      correctLegCount,
      incorrectLegCount,
      unresolvedLegCount,
      legGradeIds,
      legGrades,
    });
  }

  if (multiGradesValid && typeof proposedMultiGradeCount === 'number' && multiGrades.length === proposedMultiGradeCount) {
    for (let m = 0; m < multiGrades.length; m++) {
      const proposed = multiGrades[m];
      const expected = expectedMultiGrades[m];
      const multiPrefix = `$.multiGrades[${m}]`;

      let multiMappingValid = true;
      let legCountValid = true;
      let legIdsValid = true;

      if (proposed.candidateId !== expected.candidateId) {
        rootIssues.push({
          code: 'MULTI_GRADE_MAPPING_MISMATCH',
          path: `${multiPrefix}.candidateId`,
          message: 'candidateId must match source multi recommendation',
        });
        multiMappingValid = false;
      }

      if (proposed.legCount !== expected.legCount) {
        rootIssues.push({
          code: 'LEG_GRADE_COUNT_MISMATCH',
          path: `${multiPrefix}.legCount`,
          message: 'legCount must match source candidate leg count',
        });
        legCountValid = false;
      }

      if (
        proposed.legGradeIds.length !== expected.legGradeIds.length ||
        !proposed.legGradeIds.every((id, i) => id === expected.legGradeIds[i])
      ) {
        rootIssues.push({
          code: 'LEG_GRADE_IDS_MISMATCH',
          path: `${multiPrefix}.legGradeIds`,
          message: 'legGradeIds must match legGrades gradeId order',
        });
        legIdsValid = false;
      }

      if (multiMappingValid && legCountValid && legIdsValid) {
        for (let l = 0; l < proposed.legGrades.length; l++) {
          const proposedLeg = proposed.legGrades[l];
          const expectedLeg = expected.legGrades[l];
          const legPrefix = `${multiPrefix}.legGrades[${l}]`;

          let legMappingValid = true;

          if (proposedLeg.recommendationId !== expectedLeg.recommendationId) {
            rootIssues.push({
              code: 'LEG_GRADE_MAPPING_MISMATCH',
              path: `${legPrefix}.recommendationId`,
              message: 'recommendationId must match source multi leg',
            });
            legMappingValid = false;
          }
          if (proposedLeg.gameId !== expectedLeg.gameId) {
            rootIssues.push({
              code: 'LEG_GRADE_MAPPING_MISMATCH',
              path: `${legPrefix}.gameId`,
              message: 'gameId must match source multi leg',
            });
            legMappingValid = false;
          }
          if (proposedLeg.recommendedTeamId !== expectedLeg.recommendedTeamId) {
            rootIssues.push({
              code: 'LEG_GRADE_MAPPING_MISMATCH',
              path: `${legPrefix}.recommendedTeamId`,
              message: 'recommendedTeamId must match source multi leg',
            });
            legMappingValid = false;
          }

          if (legMappingValid) {
            if (proposedLeg.result !== expectedLeg.result) {
              rootIssues.push({
                code: 'LEG_GRADE_RESULT_MISMATCH',
                path: `${legPrefix}.result`,
                message: 'result must match deterministic multi leg grading result',
              });
            } else if (proposedLeg.gradeId !== expectedLeg.gradeId) {
              rootIssues.push({
                code: 'LEG_GRADE_ID_MISMATCH',
                path: `${legPrefix}.gradeId`,
                message: 'gradeId must match deterministic multi leg grade identity',
              });
            }
          }
        }

        if (proposed.result !== expected.result) {
          rootIssues.push({
            code: 'MULTI_GRADE_RESULT_MISMATCH',
            path: `${multiPrefix}.result`,
            message: 'result must match deterministic multi grading result',
          });
        } else if (proposed.gradeId !== expected.gradeId) {
          rootIssues.push({
            code: 'MULTI_GRADE_ID_MISMATCH',
            path: `${multiPrefix}.gradeId`,
            message: 'gradeId must match deterministic multi grade identity',
          });
        }
      }
    }
  }

  const proposedGradingIdResult = ownDataProperty(proposedRoot, 'gradingId', '$.gradingId', rootIssues);
  if (proposedGradingIdResult !== 'missing' && proposedGradingIdResult !== 'accessor') {
    const proposedGradingId = (proposedGradingIdResult as { kind: 'data'; value: unknown }).value as string;
    if (isStrictNonEmptyTrimmedString(proposedGradingId)) {
      const expectedSinglePickGradeIds = expectedSinglePickGrades.map((grade) => grade.gradeId);
      const expectedMultiGradeIds = expectedMultiGrades.map((grade) => grade.gradeId);
      const expectedGradingIdValue = deterministicGradingId(
        expectedRecommendationBundleId,
        expectedOutcomeSetId,
        expectedSinglePickGradeIds,
        expectedMultiGradeIds,
      );
      if (proposedGradingId !== expectedGradingIdValue) {
        rootIssues.push({
          code: 'GRADING_ID_MISMATCH',
          path: '$.gradingId',
          message: 'gradingId must match deterministic recommendation bundle grading identity',
        });
      }
    }
  }

  const finalRootIssues = normalizeIssues(rootIssues);
  if (finalRootIssues.length > 0) {
    return { ok: false, issues: finalRootIssues };
  }

  return { ok: true, value: proposed as MLBOfflineRecommendationBundleGrading };
}

export function buildMLBOfflineRecommendationBundleGrading(
  input: MLBOfflineRecommendationBundleGradingInput,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineRecommendationBundleGrading;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineRecommendationBundleGradingIssue[];
    }> {
  const issues: MLBOfflineRecommendationBundleGradingIssue[] = [];

  const inputRoot = input as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(inputRoot)) {
    issues.push({
      code: 'UNKNOWN_FIELD',
      path: `$[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  const recommendationBundleResult = ownDataProperty(inputRoot, 'recommendationBundle', '$.recommendationBundle', issues);
  const outcomeSetResult = ownDataProperty(inputRoot, 'outcomeSet', '$.outcomeSet', issues);

  if (recommendationBundleResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: '$.recommendationBundle',
      message: 'recommendationBundle is required',
    });
  } else if (recommendationBundleResult === 'accessor') {
    issues.push({
      code: 'INVALID_JSON_VALUE',
      path: '$.recommendationBundle',
      message: 'Accessor property: recommendationBundle',
    });
  }

  if (outcomeSetResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: '$.outcomeSet',
      message: 'outcomeSet is required',
    });
  } else if (outcomeSetResult === 'accessor') {
    issues.push({
      code: 'INVALID_JSON_VALUE',
      path: '$.outcomeSet',
      message: 'Accessor property: outcomeSet',
    });
  }

  if (recommendationBundleResult === 'missing' || recommendationBundleResult === 'accessor') {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_RECOMMENDATION_BUNDLE_INVALID',
          path: '$.recommendationBundle',
          message: 'recommendationBundle failed validation',
        },
        ...issues,
      ]),
    };
  }

  if (outcomeSetResult === 'missing' || outcomeSetResult === 'accessor') {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_OUTCOME_SET_INVALID',
          path: '$.outcomeSet',
          message: 'outcomeSet failed validation',
        },
        ...issues,
      ]),
    };
  }

  const recommendationBundleValidation = validateMLBOfflineRecommendationBundle(
    (recommendationBundleResult as { kind: 'data'; value: unknown }).value,
  );
  if (!recommendationBundleValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_RECOMMENDATION_BUNDLE_INVALID',
          path: '$.recommendationBundle',
          message: 'recommendationBundle failed validation',
        },
      ]),
    };
  }

  const outcomeSetValidation = validateMLBOfflineOfficialFinalGameOutcomeSet(
    (outcomeSetResult as { kind: 'data'; value: unknown }).value,
  );
  if (!outcomeSetValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_OUTCOME_SET_INVALID',
          path: '$.outcomeSet',
          message: 'outcomeSet failed validation',
        },
      ]),
    };
  }

  const recommendationBundle = recommendationBundleValidation.value;
  const outcomeSet = outcomeSetValidation.value;

  const outcomeLookup = buildOutcomeLookup(outcomeSet.outcomes);

  const builtSinglePickGrades: MLBOfflineSinglePickGrade[] = [];
  for (let i = 0; i < recommendationBundle.sourceSinglePickRecommendationSet.recommendations.length; i++) {
    const recommendation = recommendationBundle.sourceSinglePickRecommendationSet.recommendations[i];
    const grade = buildSinglePickGrade(recommendation, i, recommendationBundle.recommendedAt, outcomeLookup, issues);
    if (grade) {
      builtSinglePickGrades.push(grade);
    } else {
      return {
        ok: false,
        issues: normalizeIssues(issues),
      };
    }
  }

  const builtMultiGrades: MLBOfflineMultiGrade[] = [];
  for (let m = 0; m < recommendationBundle.sourceMultiRecommendationSet.selectedRecommendations.length; m++) {
    const candidate = recommendationBundle.sourceMultiRecommendationSet.selectedRecommendations[m];
    const legGrades: MLBOfflineMultiLegGrade[] = [];
    for (let l = 0; l < candidate.legs.length; l++) {
      const leg = candidate.legs[l];
      const legGrade = buildMultiLegGrade(leg, m, l, candidate.candidateId, recommendationBundle.recommendedAt, outcomeLookup, issues);
      if (legGrade) {
        legGrades.push(legGrade);
      } else {
        return {
          ok: false,
          issues: normalizeIssues(issues),
        };
      }
    }
    const multiGrade = buildMultiGrade(candidate, m, legGrades, issues);
    if (multiGrade) {
      builtMultiGrades.push(multiGrade);
    } else {
      return {
        ok: false,
        issues: normalizeIssues(issues),
      };
    }
  }

  const builtSinglePickGradeIds = builtSinglePickGrades.map((grade) => grade.gradeId);
  const builtMultiGradeIds = builtMultiGrades.map((grade) => grade.gradeId);
  const gradingId = deterministicGradingId(
    recommendationBundle.recommendationBundleId,
    outcomeSet.outcomeSetId,
    builtSinglePickGradeIds,
    builtMultiGradeIds,
  );

  const root: MLBOfflineRecommendationBundleGrading = {
    contractVersion: MLB_OFFLINE_RECOMMENDATION_BUNDLE_GRADING_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    gradingId,
    recommendationBundleId: recommendationBundle.recommendationBundleId,
    outcomeSetId: outcomeSet.outcomeSetId,
    singlePickGradeCount: builtSinglePickGrades.length,
    singlePickGradeIds: builtSinglePickGradeIds,
    multiGradeCount: builtMultiGrades.length,
    multiGradeIds: builtMultiGradeIds,
    singlePickGrades: Object.freeze(builtSinglePickGrades),
    multiGrades: Object.freeze(builtMultiGrades),
    sourceRecommendationBundle: recommendationBundle,
    sourceOutcomeSet: outcomeSet,
  };

  const frozenRoot = Object.freeze(root);
  const validation = validateMLBOfflineRecommendationBundleGrading(frozenRoot);
  if (!validation.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'GENERATED_GRADING_INVALID',
          path: '$',
          message: 'Generated recommendation bundle grading failed validation',
        },
      ],
    };
  }

  return { ok: true, value: frozenRoot };
}
