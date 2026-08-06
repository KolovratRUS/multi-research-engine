import {
  assertNoOddsContamination,
  isProhibitedOddsBoundaryKey,
} from '../firewall/odds-contamination-guard';
import {
  type MLBOfflineSinglePickRecommendation,
  type MLBOfflineSinglePickRecommendationSet,
  validateMLBOfflineSinglePickRecommendationSet,
} from './mlb-offline-single-pick-recommendation-contract';
import {
  type MLBOfflineMultiRecommendationSet,
  validateMLBOfflineMultiRecommendationSet,
} from './mlb-offline-multi-recommendation-contract';
import {
  type MLBOfflineMultiRiskGuidanceSet,
  validateMLBOfflineMultiRiskGuidanceSet,
} from './mlb-offline-multi-risk-guidance-contract';

type Phase8MMultiCandidateSet =
  MLBOfflineMultiRecommendationSet['sourceCandidateSet'];

type Phase8MMultiCandidate =
  MLBOfflineMultiRecommendationSet['selectedRecommendations'][number];

export const MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION =
  'mlb-offline-recommendation-bundle-v1' as const;

export const MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY =
  'ALL_VALIDATED_ARTIFACTS_V1' as const;

export type MLBOfflineRecommendationBundleInput = Readonly<{
  singlePickRecommendationSet: unknown;
  multiRecommendationSet: unknown;
  multiRiskGuidanceSet: unknown;
  recommendedAt: unknown;
}>;

export type MLBOfflineRecommendationBundle = Readonly<{
  contractVersion:
    typeof MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  compositionPolicy:
    typeof MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY;
  recommendationBundleId: string;
  recommendedAt: string;
  singlePickRecommendationSetId: string;
  multiRecommendationSetId: string;
  riskGuidanceSetId: string;
  sourceSinglePickRecommendationSet:
    MLBOfflineSinglePickRecommendationSet;
  sourceMultiRecommendationSet:
    MLBOfflineMultiRecommendationSet;
  sourceMultiRiskGuidanceSet:
    MLBOfflineMultiRiskGuidanceSet;
}>;

export type MLBOfflineRecommendationBundleIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'SOURCE_SINGLE_PICK_RECOMMENDATION_SET_INVALID'
    | 'SOURCE_MULTI_RECOMMENDATION_SET_INVALID'
    | 'SOURCE_MULTI_RISK_GUIDANCE_SET_INVALID'
    | 'INVALID_TIMESTAMP'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'RECOMMENDATION_BUNDLE_ID_MISMATCH'
    | 'GENERATED_RECOMMENDATION_BUNDLE_INVALID'
    | 'ODDS_CONTAMINATION'
    | 'PROHIBITED_CONCEPT';
  path: string;
  message: string;
}>;

const KNOWN_ROOT_FIELDS = new Set<string>([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'compositionPolicy',
  'recommendationBundleId',
  'recommendedAt',
  'singlePickRecommendationSetId',
  'multiRecommendationSetId',
  'riskGuidanceSetId',
  'sourceSinglePickRecommendationSet',
  'sourceMultiRecommendationSet',
  'sourceMultiRiskGuidanceSet',
]);

const KNOWN_INPUT_FIELDS = new Set<string>([
  'singlePickRecommendationSet',
  'multiRecommendationSet',
  'multiRiskGuidanceSet',
  'recommendedAt',
]);

function isPlainObject(value: unknown): boolean {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function isDataDescriptor(descriptor: PropertyDescriptor): boolean {
  return descriptor !== undefined && 'value' in descriptor;
}

function ownDataProperty(
  root: Record<string, unknown>,
  key: string,
  prefix: string,
  issues: MLBOfflineRecommendationBundleIssue[],
): 'missing' | 'accessor' | { kind: 'data'; value: unknown } {
  const descriptor = Object.getOwnPropertyDescriptor(root, key);
  if (descriptor === undefined) {
    return 'missing';
  }
  if (!isDataDescriptor(descriptor)) {
    issues.push({
      code: 'INVALID_JSON_VALUE',
      path: prefix,
      message: `Accessor property: ${key}`,
    });
    return 'accessor';
  }
  return { kind: 'data', value: descriptor.value };
}

function pushUniqueIssue(
  issues: MLBOfflineRecommendationBundleIssue[],
  issue: MLBOfflineRecommendationBundleIssue,
): void {
  const seen = issues.some(
    (existing) => existing.code === issue.code && existing.path === issue.path,
  );
  if (!seen) {
    issues.push(issue);
  }
}

function isStrictNonEmptyTrimmedString(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeIssues(
  issues: readonly MLBOfflineRecommendationBundleIssue[],
): readonly MLBOfflineRecommendationBundleIssue[] {
  const seen = new Set<string>();
  const normalized: MLBOfflineRecommendationBundleIssue[] = [];
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

function isLeapYear(year: number): boolean {
  if (year % 400 === 0) {
    return true;
  }
  if (year % 100 === 0) {
    return false;
  }
  return year % 4 === 0;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function daysInMonth(year: number, month: number): number {
  if (month === 2 && isLeapYear(year)) {
    return 29;
  }
  return MONTH_DAYS[month - 1];
}

function isValidGregorianDate(year: number, month: number, day: number): boolean {
  if (year === 0) {
    return false;
  }
  if (month < 1 || month > 12) {
    return false;
  }
  if (day < 1) {
    return false;
  }
  return day <= daysInMonth(year, month);
}

function validateCanonicalUtcTimestamp(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/,
  );
  if (match === null) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (!isValidGregorianDate(year, month, day)) {
    return false;
  }
  if (hour < 0 || hour > 23) {
    return false;
  }
  if (minute < 0 || minute > 59) {
    return false;
  }
  if (second < 0 || second > 59) {
    return false;
  }

  return true;
}

function equalsProbabilityObject(
  left: unknown,
  right: unknown,
  prefix: string,
  issues: MLBOfflineRecommendationBundleIssue[],
): boolean {
  if (!isPlainObject(left) || !isPlainObject(right)) {
    return false;
  }

  const leftRoot = left as Record<string, unknown>;
  const rightRoot = right as Record<string, unknown>;

  const leftHome =
    typeof leftRoot.homeWinProbability === 'number'
      ? leftRoot.homeWinProbability
      : Number.NaN;
  const rightHome =
    typeof rightRoot.homeWinProbability === 'number'
      ? rightRoot.homeWinProbability
      : Number.NaN;
  if (leftHome !== rightHome || Number.isNaN(leftHome)) {
    return false;
  }

  const leftAway =
    typeof leftRoot.awayWinProbability === 'number'
      ? leftRoot.awayWinProbability
      : Number.NaN;
  const rightAway =
    typeof rightRoot.awayWinProbability === 'number'
      ? rightRoot.awayWinProbability
      : Number.NaN;
  if (leftAway !== rightAway || Number.isNaN(leftAway)) {
    return false;
  }

  return (
    leftHome === rightHome &&
    leftAway === rightAway &&
    !Number.isNaN(leftHome) &&
    !Number.isNaN(leftAway)
  );
}

function isSinglePickRecommendationEquivalent(
  left: MLBOfflineSinglePickRecommendation,
  right: MLBOfflineSinglePickRecommendation,
  prefix: string,
  issues: MLBOfflineRecommendationBundleIssue[],
): boolean {
  let equal = true;

  if (left.recommendationId !== right.recommendationId) {
    equal = false;
  }
  if (left.inferenceId !== right.inferenceId) {
    equal = false;
  }
  if (left.snapshotId !== right.snapshotId) {
    equal = false;
  }
  if (left.gameId !== right.gameId) {
    equal = false;
  }
  if (left.officialDate !== right.officialDate) {
    equal = false;
  }
  if (left.dataCutoffAt !== right.dataCutoffAt) {
    equal = false;
  }
  if (left.homeTeamId !== right.homeTeamId) {
    equal = false;
  }
  if (left.awayTeamId !== right.awayTeamId) {
    equal = false;
  }
  if (left.recommendedSide !== right.recommendedSide) {
    equal = false;
  }
  if (left.recommendedTeamId !== right.recommendedTeamId) {
    equal = false;
  }

  const probEqual = equalsProbabilityObject(
    left.probabilities,
    right.probabilities,
    `${prefix}.probabilities`,
    issues,
  );
  if (!probEqual) {
    equal = false;
  }

  if (left.modelConfidence !== right.modelConfidence) {
    equal = false;
  }
  if (left.modelUncertainty !== right.modelUncertainty) {
    equal = false;
  }

  return equal;
}

function isSinglePickRecommendationSetEquivalentToMultiCandidateSet(
  singlePickSet: MLBOfflineSinglePickRecommendationSet,
  multiCandidateSet: Phase8MMultiCandidateSet,
  prefix: string,
  issues: MLBOfflineRecommendationBundleIssue[],
): boolean {
  let equal = true;

  if (singlePickSet.recommendationSetId !== multiCandidateSet.recommendationSetId) {
    equal = false;
  }
  if (singlePickSet.slateId !== multiCandidateSet.slateId) {
    equal = false;
  }
  if (singlePickSet.releaseId !== multiCandidateSet.releaseId) {
    equal = false;
  }
  if (singlePickSet.modelId !== multiCandidateSet.modelId) {
    equal = false;
  }
  if (singlePickSet.planId !== multiCandidateSet.planId) {
    equal = false;
  }
  if (singlePickSet.matrixId !== multiCandidateSet.matrixId) {
    equal = false;
  }
  if (singlePickSet.configId !== multiCandidateSet.configId) {
    equal = false;
  }
  if (singlePickSet.manifestId !== multiCandidateSet.manifestId) {
    equal = false;
  }
  if (singlePickSet.algorithm !== multiCandidateSet.algorithm) {
    equal = false;
  }
  if (singlePickSet.decisionPolicy !== multiCandidateSet.decisionPolicy) {
    equal = false;
  }
  if (singlePickSet.officialDate !== multiCandidateSet.officialDate) {
    equal = false;
  }
  if (singlePickSet.recommendationPolicy !== multiCandidateSet.sourceRecommendationPolicy) {
    equal = false;
  }
  if (singlePickSet.recommendationCount !== multiCandidateSet.sourceRecommendationCount) {
    equal = false;
  }

  const singlePickIds = singlePickSet.recommendations.map(
    (recommendation) => recommendation.recommendationId,
  );
  if (singlePickIds.length !== multiCandidateSet.sourceRecommendationIds.length) {
    equal = false;
  } else {
    for (let i = 0; i < singlePickIds.length; i++) {
      if (singlePickIds[i] !== multiCandidateSet.sourceRecommendationIds[i]) {
        equal = false;
        break;
      }
    }
  }

  const recommendationLookup = new Map<string, MLBOfflineSinglePickRecommendation>();
  for (const rec of singlePickSet.recommendations) {
    recommendationLookup.set(rec.recommendationId, rec);
  }

  for (let i = 0; i < multiCandidateSet.candidates.length; i++) {
    const candidate = multiCandidateSet.candidates[i];
    for (let j = 0; j < candidate.legs.length; j++) {
      const leg = candidate.legs[j];
      const expected = recommendationLookup.get(leg.recommendationId);
      if (!expected) {
        equal = false;
      } else if (!isSinglePickRecommendationEquivalent(expected, leg, `${prefix}.candidates[${i}].legs[${j}]`, issues)) {
        equal = false;
      }
    }
  }

  return equal;
}

function isMultiCandidateEquivalent(
  left: Phase8MMultiCandidate,
  right: Phase8MMultiCandidate,
  prefix: string,
  issues: MLBOfflineRecommendationBundleIssue[],
): boolean {
  let equal = true;

  if (left.candidateId !== right.candidateId) {
    equal = false;
  }
  if (left.legCount !== right.legCount) {
    equal = false;
  }
  if (left.minimumLegConfidence !== right.minimumLegConfidence) {
    equal = false;
  }
  if (left.meanLegConfidence !== right.meanLegConfidence) {
    equal = false;
  }
  if (left.maximumLegUncertainty !== right.maximumLegUncertainty) {
    equal = false;
  }

  if (left.legs.length !== right.legs.length) {
    equal = false;
  } else {
    for (let i = 0; i < left.legs.length; i++) {
      if (!isSinglePickRecommendationEquivalent(left.legs[i], right.legs[i], `${prefix}.legs[${i}]`, issues)) {
        equal = false;
      }
    }
  }

  return equal;
}

function isMultiCandidateSetEquivalent(
  left: Phase8MMultiCandidateSet,
  right: Phase8MMultiCandidateSet,
  prefix: string,
  issues: MLBOfflineRecommendationBundleIssue[],
): boolean {
  let equal = true;

  const scalarFields = [
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
    'candidateCount',
  ] as const;

  for (const field of scalarFields) {
    const leftValue = left[field as keyof Phase8MMultiCandidateSet];
    const rightValue = right[field as keyof Phase8MMultiCandidateSet];
    if (leftValue !== rightValue) {
      equal = false;
    }
  }

  if (left.sourceRecommendationIds.length !== right.sourceRecommendationIds.length) {
    equal = false;
  } else {
    for (let i = 0; i < left.sourceRecommendationIds.length; i++) {
      if (left.sourceRecommendationIds[i] !== right.sourceRecommendationIds[i]) {
        equal = false;
        break;
      }
    }
  }

  if (left.candidates.length !== right.candidates.length) {
    equal = false;
  } else {
    for (let i = 0; i < left.candidates.length; i++) {
      if (!isMultiCandidateEquivalent(left.candidates[i], right.candidates[i], `${prefix}.candidates[${i}]`, issues)) {
        equal = false;
      }
    }
  }

  return equal;
}

function isMultiRecommendationSetEquivalent(
  left: MLBOfflineMultiRecommendationSet,
  right: MLBOfflineMultiRecommendationSet,
  prefix: string,
  issues: MLBOfflineRecommendationBundleIssue[],
): boolean {
  let equal = true;

  const scalarFields = [
    'contractVersion',
    'sport',
    'target',
    'targetEncoding',
    'multiRecommendationSetId',
    'candidateSetId',
    'selectionPolicy',
    'selectedRecommendationCount',
  ] as const;

  for (const field of scalarFields) {
    const leftValue = left[field as keyof MLBOfflineMultiRecommendationSet];
    const rightValue = right[field as keyof MLBOfflineMultiRecommendationSet];
    if (leftValue !== rightValue) {
      equal = false;
    }
  }

  if (!isMultiCandidateSetEquivalent(left.sourceCandidateSet, right.sourceCandidateSet, `${prefix}.sourceCandidateSet`, issues)) {
    equal = false;
  }

  if (left.selectedRecommendationIds.length !== right.selectedRecommendationIds.length) {
    equal = false;
  } else {
    for (let i = 0; i < left.selectedRecommendationIds.length; i++) {
      if (left.selectedRecommendationIds[i] !== right.selectedRecommendationIds[i]) {
        equal = false;
        break;
      }
    }
  }

  if (left.selectedRecommendations.length !== right.selectedRecommendations.length) {
    equal = false;
  } else {
    for (let i = 0; i < left.selectedRecommendations.length; i++) {
      if (!isMultiCandidateEquivalent(left.selectedRecommendations[i], right.selectedRecommendations[i], `${prefix}.selectedRecommendations[${i}]`, issues)) {
        equal = false;
      }
    }
  }

  return equal;
}

function validatePublicRoot(
  proposed: unknown,
): MLBOfflineRecommendationBundleIssue[] {
  const issues: MLBOfflineRecommendationBundleIssue[] = [];

  if (!isPlainObject(proposed)) {
    issues.push({
      code: 'NOT_PLAIN_OBJECT',
      path: '$',
      message: 'Recommendation bundle must be a plain object',
    });
    return issues;
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
    if (KNOWN_ROOT_FIELDS.has(key)) {
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

  for (const key of Object.getOwnPropertyNames(root)) {
    if (isProhibitedOddsBoundaryKey(key)) {
      issues.length = 0;
      pushUniqueIssue(issues, {
        code: 'ODDS_CONTAMINATION',
        path: '$',
        message: 'Odds contamination detected',
      });
      return issues;
    }
  }

  try {
    assertNoOddsContamination(root);
  } catch (error) {
    if (error instanceof Error && error.message.includes('ODDS_CONTAMINATION')) {
      issues.length = 0;
      pushUniqueIssue(issues, {
        code: 'ODDS_CONTAMINATION',
        path: '$',
        message: 'Odds contamination detected',
      });
      return issues;
    }
    issues.length = 0;
    pushUniqueIssue(issues, {
      code: 'INVALID_JSON_VALUE',
      path: '$',
      message: 'Uninspectable accessor property',
    });
    return issues;
  }

  if (root.stake !== undefined) {
    pushUniqueIssue(issues, {
      code: 'PROHIBITED_CONCEPT',
      path: '$.stake',
      message: 'Prohibited concept detected',
    });
  }
  if (root.grade !== undefined) {
    pushUniqueIssue(issues, {
      code: 'PROHIBITED_CONCEPT',
      path: '$.grade',
      message: 'Prohibited concept detected',
    });
  }

  if (root.stake !== undefined || root.grade !== undefined) {
    return issues;
  }

  const fields: { key: string; path: string }[] = [
    { key: 'contractVersion', path: '$.contractVersion' },
    { key: 'sport', path: '$.sport' },
    { key: 'target', path: '$.target' },
    { key: 'targetEncoding', path: '$.targetEncoding' },
    { key: 'compositionPolicy', path: '$.compositionPolicy' },
    { key: 'recommendationBundleId', path: '$.recommendationBundleId' },
    { key: 'recommendedAt', path: '$.recommendedAt' },
    { key: 'singlePickRecommendationSetId', path: '$.singlePickRecommendationSetId' },
    { key: 'multiRecommendationSetId', path: '$.multiRecommendationSetId' },
    { key: 'riskGuidanceSetId', path: '$.riskGuidanceSetId' },
    { key: 'sourceSinglePickRecommendationSet', path: '$.sourceSinglePickRecommendationSet' },
    { key: 'sourceMultiRecommendationSet', path: '$.sourceMultiRecommendationSet' },
    { key: 'sourceMultiRiskGuidanceSet', path: '$.sourceMultiRiskGuidanceSet' },
  ];

  for (const field of fields) {
    const result = ownDataProperty(root, field.key, field.path, issues);
    if (result === 'missing') {
      pushUniqueIssue(issues, {
        code: 'MISSING_FIELD',
        path: field.path,
        message: `${field.key} is required`,
      });
    }
  }

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_ROOT_FIELDS.has(key)) {
      pushUniqueIssue(issues, {
        code: 'UNKNOWN_FIELD',
        path: `$.${key}`,
        message: `Unknown field: ${key}`,
      });
    }
  }

  for (const field of fields) {
    if (
      field.key === 'sourceSinglePickRecommendationSet' ||
      field.key === 'sourceMultiRecommendationSet' ||
      field.key === 'sourceMultiRiskGuidanceSet'
    ) {
      continue;
    }
    const result = ownDataProperty(root, field.key, field.path, issues);
    if (result === 'accessor') {
      continue;
    }
    if (result === 'missing') {
      continue;
    }
    const value = (result as { kind: 'data'; value: unknown }).value;

    if (field.key === 'contractVersion') {
      if (value !== MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION) {
        pushUniqueIssue(issues, {
          code: 'INVALID_LITERAL',
          path: field.path,
          message: `contractVersion must be ${MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION}`,
        });
      }
    } else if (field.key === 'sport') {
      if (value !== 'MLB') {
        pushUniqueIssue(issues, {
          code: 'INVALID_LITERAL',
          path: field.path,
          message: 'sport must be MLB',
        });
      }
    } else if (field.key === 'target') {
      if (value !== 'OFFICIAL_FINAL_GAME_WINNER') {
        pushUniqueIssue(issues, {
          code: 'INVALID_LITERAL',
          path: field.path,
          message: 'target must be OFFICIAL_FINAL_GAME_WINNER',
        });
      }
    } else if (field.key === 'targetEncoding') {
      if (value !== 'HOME_WIN_1_AWAY_WIN_0') {
        pushUniqueIssue(issues, {
          code: 'INVALID_LITERAL',
          path: field.path,
          message: 'targetEncoding must be HOME_WIN_1_AWAY_WIN_0',
        });
      }
    } else if (field.key === 'compositionPolicy') {
      if (value !== MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY) {
        pushUniqueIssue(issues, {
          code: 'INVALID_LITERAL',
          path: field.path,
          message: `compositionPolicy must be ${MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY}`,
        });
      }
    } else if (field.key === 'recommendedAt') {
      if (!validateCanonicalUtcTimestamp(value)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_TIMESTAMP',
          path: field.path,
          message:
            'recommendedAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
        });
      }
    } else if (
      field.key === 'recommendationBundleId' ||
      field.key === 'singlePickRecommendationSetId' ||
      field.key === 'multiRecommendationSetId' ||
      field.key === 'riskGuidanceSetId'
    ) {
      if (!isStrictNonEmptyTrimmedString(value)) {
        pushUniqueIssue(issues, {
          code: 'INVALID_STRING',
          path: field.path,
          message: `${field.key} must be a valid identifier`,
        });
      }
    }
  }

  let sourceSinglePickRecommendationSet: MLBOfflineSinglePickRecommendationSet | null = null;
  let sourceMultiRecommendationSet: MLBOfflineMultiRecommendationSet | null = null;
  let sourceMultiRiskGuidanceSet: MLBOfflineMultiRiskGuidanceSet | null = null;
  let recommendedAt: string | null = null;

  const singlePickResult = ownDataProperty(root, 'sourceSinglePickRecommendationSet', '$.sourceSinglePickRecommendationSet', issues);
  if (singlePickResult !== 'missing' && singlePickResult !== 'accessor') {
    const singlePickSource = (singlePickResult as { kind: 'data'; value: unknown }).value;
    const singlePickValidation = validateMLBOfflineSinglePickRecommendationSet(singlePickSource);
    if (!singlePickValidation.ok) {
      issues.length = 0;
      pushUniqueIssue(issues, {
        code: 'SOURCE_SINGLE_PICK_RECOMMENDATION_SET_INVALID',
        path: '$.sourceSinglePickRecommendationSet',
        message: 'Source single-pick recommendation set is invalid',
      });
      return issues;
    }
    sourceSinglePickRecommendationSet = singlePickValidation.value;
  }

  const multiResult = ownDataProperty(root, 'sourceMultiRecommendationSet', '$.sourceMultiRecommendationSet', issues);
  if (multiResult !== 'missing' && multiResult !== 'accessor') {
    const multiSource = (multiResult as { kind: 'data'; value: unknown }).value;
    const multiValidation = validateMLBOfflineMultiRecommendationSet(multiSource);
    if (!multiValidation.ok) {
      issues.length = 0;
      pushUniqueIssue(issues, {
        code: 'SOURCE_MULTI_RECOMMENDATION_SET_INVALID',
        path: '$.sourceMultiRecommendationSet',
        message: 'Source multi-recommendation set is invalid',
      });
      return issues;
    }
    sourceMultiRecommendationSet = multiValidation.value;
  }

  const riskResult = ownDataProperty(root, 'sourceMultiRiskGuidanceSet', '$.sourceMultiRiskGuidanceSet', issues);
  if (riskResult !== 'missing' && riskResult !== 'accessor') {
    const riskSource = (riskResult as { kind: 'data'; value: unknown }).value;
    const riskValidation = validateMLBOfflineMultiRiskGuidanceSet(riskSource);
    if (!riskValidation.ok) {
      issues.length = 0;
      pushUniqueIssue(issues, {
        code: 'SOURCE_MULTI_RISK_GUIDANCE_SET_INVALID',
        path: '$.sourceMultiRiskGuidanceSet',
        message: 'Source multi-risk-guidance set is invalid',
      });
      return issues;
    }
    sourceMultiRiskGuidanceSet = riskValidation.value;
  }

  const recommendedAtResult = ownDataProperty(root, 'recommendedAt', '$.recommendedAt', issues);
  if (recommendedAtResult !== 'missing' && recommendedAtResult !== 'accessor') {
    recommendedAt = (recommendedAtResult as { kind: 'data'; value: unknown }).value as string;
  }

  if (sourceSinglePickRecommendationSet) {
    const idResult = ownDataProperty(root, 'singlePickRecommendationSetId', '$.singlePickRecommendationSetId', issues);
    if (idResult !== 'missing' && idResult !== 'accessor') {
      const idValue = (idResult as { kind: 'data'; value: unknown }).value as string;
      if (isStrictNonEmptyTrimmedString(idValue)) {
        if (idValue !== sourceSinglePickRecommendationSet.recommendationSetId) {
          pushUniqueIssue(issues, {
            code: 'SOURCE_IDENTITY_MISMATCH',
            path: '$.singlePickRecommendationSetId',
            message: 'Single-pick recommendation-set identity does not match embedded source',
          });
        }
      }
    }
  }

  if (sourceMultiRecommendationSet) {
    const idResult = ownDataProperty(root, 'multiRecommendationSetId', '$.multiRecommendationSetId', issues);
    if (idResult !== 'missing' && idResult !== 'accessor') {
      const idValue = (idResult as { kind: 'data'; value: unknown }).value as string;
      if (isStrictNonEmptyTrimmedString(idValue)) {
        if (idValue !== sourceMultiRecommendationSet.multiRecommendationSetId) {
          pushUniqueIssue(issues, {
            code: 'SOURCE_IDENTITY_MISMATCH',
            path: '$.multiRecommendationSetId',
            message: 'Multi-recommendation-set identity does not match embedded source',
          });
        }
      }
    }
  }

  if (sourceMultiRiskGuidanceSet) {
    const idResult = ownDataProperty(root, 'riskGuidanceSetId', '$.riskGuidanceSetId', issues);
    if (idResult !== 'missing' && idResult !== 'accessor') {
      const idValue = (idResult as { kind: 'data'; value: unknown }).value as string;
      if (isStrictNonEmptyTrimmedString(idValue)) {
        if (idValue !== sourceMultiRiskGuidanceSet.riskGuidanceSetId) {
          pushUniqueIssue(issues, {
            code: 'SOURCE_IDENTITY_MISMATCH',
            path: '$.riskGuidanceSetId',
            message: 'Risk-guidance-set identity does not match embedded source',
          });
        }
      }
    }
  }

  if (
    sourceSinglePickRecommendationSet &&
    sourceMultiRecommendationSet &&
    !isSinglePickRecommendationSetEquivalentToMultiCandidateSet(
      sourceSinglePickRecommendationSet,
      sourceMultiRecommendationSet.sourceCandidateSet,
      '$.sourceSinglePickRecommendationSet',
      issues,
    )
  ) {
    pushUniqueIssue(issues, {
      code: 'SOURCE_IDENTITY_MISMATCH',
      path: '$.sourceSinglePickRecommendationSet',
      message: 'Single-pick recommendation set does not match embedded multi-candidate lineage',
    });
  }

  if (
    sourceMultiRecommendationSet &&
    sourceMultiRiskGuidanceSet &&
    !isMultiRecommendationSetEquivalent(
      sourceMultiRecommendationSet,
      sourceMultiRiskGuidanceSet.sourceMultiRecommendationSet,
      '$.sourceMultiRecommendationSet',
      issues,
    )
  ) {
    pushUniqueIssue(issues, {
      code: 'SOURCE_IDENTITY_MISMATCH',
      path: '$.sourceMultiRecommendationSet',
      message: 'Multi-recommendation set does not match embedded risk-guidance lineage',
    });
  }

  const bundleIdResult = ownDataProperty(root, 'recommendationBundleId', '$.recommendationBundleId', issues);
  if (
    sourceSinglePickRecommendationSet &&
    sourceMultiRecommendationSet &&
    sourceMultiRiskGuidanceSet &&
    recommendedAt &&
    validateCanonicalUtcTimestamp(recommendedAt) &&
    bundleIdResult !== 'missing' &&
    bundleIdResult !== 'accessor'
  ) {
    const bundleId = (bundleIdResult as { kind: 'data'; value: unknown }).value as string;
    const expectedBundleId =
      sourceSinglePickRecommendationSet.recommendationSetId +
      '::' +
      sourceMultiRecommendationSet.multiRecommendationSetId +
      '::' +
      sourceMultiRiskGuidanceSet.riskGuidanceSetId +
      '::' +
      recommendedAt +
      '::offline-recommendation-bundle-v1';

    if (bundleId !== expectedBundleId) {
      pushUniqueIssue(issues, {
        code: 'RECOMMENDATION_BUNDLE_ID_MISMATCH',
        path: '$.recommendationBundleId',
        message: 'Recommendation bundle ID does not match deterministic identity',
      });
    }
  }

  return issues;
}

export function validateMLBOfflineRecommendationBundle(
  proposed: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineRecommendationBundle;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineRecommendationBundleIssue[];
    }> {
  const issues = validatePublicRoot(proposed);

  if (issues.length > 0) {
    return { ok: false, issues: normalizeIssues(issues) };
  }

  const root = proposed as MLBOfflineRecommendationBundle;

  return { ok: true, value: root };
}

export function buildMLBOfflineRecommendationBundle(
  input: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineRecommendationBundle;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineRecommendationBundleIssue[];
    }> {
  const inputIssues: MLBOfflineRecommendationBundleIssue[] = [];

  if (!isPlainObject(input)) {
    pushUniqueIssue(inputIssues, {
      code: 'NOT_PLAIN_OBJECT',
      path: '$',
      message: 'Recommendation bundle input must be a plain object',
    });
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  const inputRoot = input as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(inputRoot)) {
    pushUniqueIssue(inputIssues, {
      code: 'UNKNOWN_FIELD',
      path: `$[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  for (const key of Object.getOwnPropertyNames(inputRoot)) {
    if (KNOWN_INPUT_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(inputRoot, key);
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushUniqueIssue(inputIssues, {
          code: 'INVALID_JSON_VALUE',
          path: `$.${key}`,
          message: `Accessor property: ${key}`,
        });
      }
    }
  }

  const inputStringNames = Object.getOwnPropertyNames(inputRoot);

  if (inputRoot.stake !== undefined) {
    pushUniqueIssue(inputIssues, {
      code: 'PROHIBITED_CONCEPT',
      path: '$.stake',
      message: 'Prohibited concept detected',
    });
  }
  if (inputRoot.grade !== undefined) {
    pushUniqueIssue(inputIssues, {
      code: 'PROHIBITED_CONCEPT',
      path: '$.grade',
      message: 'Prohibited concept detected',
    });
  }

  if (inputRoot.stake !== undefined || inputRoot.grade !== undefined) {
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  const inputFields: { key: string; path: string }[] = [
    { key: 'singlePickRecommendationSet', path: '$.singlePickRecommendationSet' },
    { key: 'multiRecommendationSet', path: '$.multiRecommendationSet' },
    { key: 'multiRiskGuidanceSet', path: '$.multiRiskGuidanceSet' },
    { key: 'recommendedAt', path: '$.recommendedAt' },
  ];

  for (const field of inputFields) {
    const result = ownDataProperty(inputRoot, field.key, field.path, inputIssues);
    if (result === 'missing') {
      pushUniqueIssue(inputIssues, {
        code: 'MISSING_FIELD',
        path: field.path,
        message: `${field.key} is required`,
      });
    }
  }

  for (const key of inputStringNames) {
    if (!KNOWN_INPUT_FIELDS.has(key)) {
      pushUniqueIssue(inputIssues, {
        code: 'UNKNOWN_FIELD',
        path: `$.${key}`,
        message: `Unknown field: ${key}`,
      });
    }
  }

  let sourceSinglePickRecommendationSet: MLBOfflineSinglePickRecommendationSet | null = null;
  let sourceMultiRecommendationSet: MLBOfflineMultiRecommendationSet | null = null;
  let sourceMultiRiskGuidanceSet: MLBOfflineMultiRiskGuidanceSet | null = null;
  let recommendedAt: string | null = null;

  const singlePickResult = ownDataProperty(inputRoot, 'singlePickRecommendationSet', '$.singlePickRecommendationSet', inputIssues);
  if (singlePickResult !== 'missing' && singlePickResult !== 'accessor') {
    const singlePickSource = (singlePickResult as { kind: 'data'; value: unknown }).value;
    const singlePickValidation = validateMLBOfflineSinglePickRecommendationSet(singlePickSource);
    if (!singlePickValidation.ok) {
      inputIssues.length = 0;
      pushUniqueIssue(inputIssues, {
        code: 'SOURCE_SINGLE_PICK_RECOMMENDATION_SET_INVALID',
        path: '$.singlePickRecommendationSet',
        message: 'Source single-pick recommendation set is invalid',
      });
      return { ok: false, issues: normalizeIssues(inputIssues) };
    }
    sourceSinglePickRecommendationSet = singlePickValidation.value;
  }

  const multiResult = ownDataProperty(inputRoot, 'multiRecommendationSet', '$.multiRecommendationSet', inputIssues);
  if (multiResult !== 'missing' && multiResult !== 'accessor') {
    const multiSource = (multiResult as { kind: 'data'; value: unknown }).value;
    const multiValidation = validateMLBOfflineMultiRecommendationSet(multiSource);
    if (!multiValidation.ok) {
      inputIssues.length = 0;
      pushUniqueIssue(inputIssues, {
        code: 'SOURCE_MULTI_RECOMMENDATION_SET_INVALID',
        path: '$.multiRecommendationSet',
        message: 'Source multi-recommendation set is invalid',
      });
      return { ok: false, issues: normalizeIssues(inputIssues) };
    }
    sourceMultiRecommendationSet = multiValidation.value;
  }

  const riskResult = ownDataProperty(inputRoot, 'multiRiskGuidanceSet', '$.multiRiskGuidanceSet', inputIssues);
  if (riskResult !== 'missing' && riskResult !== 'accessor') {
    const riskSource = (riskResult as { kind: 'data'; value: unknown }).value;
    const riskValidation = validateMLBOfflineMultiRiskGuidanceSet(riskSource);
    if (!riskValidation.ok) {
      inputIssues.length = 0;
      pushUniqueIssue(inputIssues, {
        code: 'SOURCE_MULTI_RISK_GUIDANCE_SET_INVALID',
        path: '$.multiRiskGuidanceSet',
        message: 'Source multi-risk-guidance set is invalid',
      });
      return { ok: false, issues: normalizeIssues(inputIssues) };
    }
    sourceMultiRiskGuidanceSet = riskValidation.value;
  }

  const timestampResult = ownDataProperty(inputRoot, 'recommendedAt', '$.recommendedAt', inputIssues);
  if (timestampResult === 'missing') {
    inputIssues.length = 0;
    pushUniqueIssue(inputIssues, {
      code: 'MISSING_FIELD',
      path: '$.recommendedAt',
      message: 'recommendedAt is required',
    });
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }
  if (timestampResult === 'accessor') {
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }
  const timestampValue = (timestampResult as { kind: 'data'; value: unknown }).value;
  if (typeof timestampValue !== 'string' || !validateCanonicalUtcTimestamp(timestampValue)) {
    inputIssues.length = 0;
    pushUniqueIssue(inputIssues, {
      code: 'INVALID_TIMESTAMP',
      path: '$.recommendedAt',
      message:
        'recommendedAt must be a canonical UTC timestamp in YYYY-MM-DDTHH:mm:ss.sssZ format',
    });
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }
  recommendedAt = timestampValue;

  if (
    sourceSinglePickRecommendationSet &&
    sourceMultiRecommendationSet &&
    !isSinglePickRecommendationSetEquivalentToMultiCandidateSet(
      sourceSinglePickRecommendationSet,
      sourceMultiRecommendationSet.sourceCandidateSet,
      '$.singlePickRecommendationSet',
      inputIssues,
    )
  ) {
    pushUniqueIssue(inputIssues, {
      code: 'SOURCE_IDENTITY_MISMATCH',
      path: '$.singlePickRecommendationSet',
      message: 'Single-pick recommendation set does not match embedded multi-candidate lineage',
    });
  }

  if (
    sourceMultiRecommendationSet &&
    sourceMultiRiskGuidanceSet &&
    !isMultiRecommendationSetEquivalent(
      sourceMultiRecommendationSet,
      sourceMultiRiskGuidanceSet.sourceMultiRecommendationSet,
      '$.multiRecommendationSet',
      inputIssues,
    )
  ) {
    pushUniqueIssue(inputIssues, {
      code: 'SOURCE_IDENTITY_MISMATCH',
      path: '$.multiRecommendationSet',
      message: 'Multi-recommendation set does not match embedded risk-guidance lineage',
    });
  }

  if (inputIssues.length > 0) {
    return { ok: false, issues: normalizeIssues(inputIssues) };
  }

  if (
    !sourceSinglePickRecommendationSet ||
    !sourceMultiRecommendationSet ||
    !sourceMultiRiskGuidanceSet ||
    !recommendedAt
  ) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'GENERATED_RECOMMENDATION_BUNDLE_INVALID',
          path: '$',
          message: 'Generated recommendation bundle failed validation',
        },
      ]),
    };
  }

  const recommendationBundleId =
    sourceSinglePickRecommendationSet.recommendationSetId +
    '::' +
    sourceMultiRecommendationSet.multiRecommendationSetId +
    '::' +
    sourceMultiRiskGuidanceSet.riskGuidanceSetId +
    '::' +
    recommendedAt +
    '::offline-recommendation-bundle-v1';

  const root = Object.freeze({
    contractVersion: MLB_OFFLINE_RECOMMENDATION_BUNDLE_CONTRACT_VERSION,
    sport: 'MLB' as const,
    target: 'OFFICIAL_FINAL_GAME_WINNER' as const,
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0' as const,
    compositionPolicy: MLB_OFFLINE_RECOMMENDATION_BUNDLE_COMPOSITION_POLICY,
    recommendationBundleId,
    recommendedAt,
    singlePickRecommendationSetId: sourceSinglePickRecommendationSet.recommendationSetId,
    multiRecommendationSetId: sourceMultiRecommendationSet.multiRecommendationSetId,
    riskGuidanceSetId: sourceMultiRiskGuidanceSet.riskGuidanceSetId,
    sourceSinglePickRecommendationSet,
    sourceMultiRecommendationSet,
    sourceMultiRiskGuidanceSet,
  });

  const validation = validateMLBOfflineRecommendationBundle(root);
  if (!validation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'GENERATED_RECOMMENDATION_BUNDLE_INVALID',
          path: '$',
          message: 'Generated recommendation bundle failed validation',
        },
      ]),
    };
  }

  return { ok: true, value: root };
}
