import { assertNoOddsContamination, isProhibitedOddsBoundaryKey } from '../firewall/odds-contamination-guard';
import {
  type MLBOfflineMultiCandidate,
  type MLBOfflineMultiCandidateSet,
  validateMLBOfflineMultiCandidateSet,
} from './mlb-offline-multi-candidate-contract';

export const MLB_OFFLINE_MULTI_RECOMMENDATION_SET_CONTRACT_VERSION =
  'mlb-offline-multi-recommendation-set-v1' as const;

export const MLB_OFFLINE_MULTI_RECOMMENDATION_SELECTION_POLICY =
  'BEST_CANDIDATE_PER_LEG_COUNT_V1' as const;

export type MLBOfflineSelectedRecommendation = MLBOfflineMultiCandidate;

export type MLBOfflineMultiRecommendationSet = Readonly<{
  contractVersion: typeof MLB_OFFLINE_MULTI_RECOMMENDATION_SET_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  multiRecommendationSetId: string;
  candidateSetId: string;
  selectionPolicy: typeof MLB_OFFLINE_MULTI_RECOMMENDATION_SELECTION_POLICY;
  sourceCandidateSet: MLBOfflineMultiCandidateSet;
  selectedRecommendationCount: number;
  selectedRecommendationIds: readonly string[];
  selectedRecommendations: readonly MLBOfflineSelectedRecommendation[];
}>;

export type MLBOfflineMultiRecommendationSetIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'SOURCE_CANDIDATE_SET_INVALID'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'SELECTED_RECOMMENDATION_INVALID'
    | 'DUPLICATE_SELECTED_RECOMMENDATION_ID'
    | 'ORDER_MISMATCH'
    | 'SELECTED_RECOMMENDATION_ID_MISMATCH'
    | 'MULTI_RECOMMENDATION_SET_ID_MISMATCH'
    | 'SELECTED_RECOMMENDATION_COUNT_MISMATCH'
    | 'SELECTED_RECOMMENDATION_COMPLETENESS_MISMATCH'
    | 'GENERATED_MULTI_RECOMMENDATION_SET_INVALID'
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
  issues: MLBOfflineMultiRecommendationSetIssue[],
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
  issues: MLBOfflineMultiRecommendationSetIssue[],
  issue: MLBOfflineMultiRecommendationSetIssue,
): void {
  const exists = issues.some(
    (item) => item.path === issue.path && item.code === issue.code,
  );
  if (!exists) {
    issues.push(issue);
  }
}

function normalizeIssues(
  issues: MLBOfflineMultiRecommendationSetIssue[],
): readonly MLBOfflineMultiRecommendationSetIssue[] {
  const unique = new Map<string, MLBOfflineMultiRecommendationSetIssue>();
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

const KNOWN_SET_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'multiRecommendationSetId',
  'candidateSetId',
  'selectionPolicy',
  'sourceCandidateSet',
  'selectedRecommendationCount',
  'selectedRecommendationIds',
  'selectedRecommendations',
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

const KNOWN_SELECTED_FIELDS = new Set([
  'candidateId',
  'legCount',
  'minimumLegConfidence',
  'meanLegConfidence',
  'maximumLegUncertainty',
  'legs',
]);

const PROHIBITED_SELECTED_FIELDS = new Set([
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
  issues: MLBOfflineMultiRecommendationSetIssue[],
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
        pushUniqueIssue(issues, {
          code: 'PROHIBITED_CONCEPT',
          path: `${prefix}.${key}`,
          message: `Prohibited field: ${key}`,
        });
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
  issues: MLBOfflineMultiRecommendationSetIssue[],
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
      if (PROHIBITED_SET_FIELDS.has(normalizedKey)) {
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
          message: `Accessor property: ${key}`,
        });
      }
    }
  }

  const hasAccessor = issues.some((issue) => issue.code === 'INVALID_JSON_VALUE' && issue.path.startsWith(`${prefix}[`));
  return !hasAccessor;
}

function validateProbabilityObject(
  value: unknown,
  prefix: string,
  issues: MLBOfflineMultiRecommendationSetIssue[],
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
        code: 'INVALID_NUMBER',
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
        code: 'INVALID_NUMBER',
        path: `${prefix}.awayWinProbability`,
        message: 'awayWinProbability must be a finite number in [0,1]',
      });
    } else {
      awayWinProbability = awayValue;
    }
  }

  if (homeWinProbability !== null && awayWinProbability !== null && awayWinProbability !== 1 - homeWinProbability) {
    issues.push({
      code: 'INVALID_NUMBER',
      path: prefix,
      message: 'awayWinProbability must equal 1 - homeWinProbability',
    });
  }

  if (homeWinProbability === null || awayWinProbability === null) {
    return null;
  }

  return { homeWinProbability, awayWinProbability };
}

function isSelectedSourceEquivalent(
  selected: Record<string, unknown>,
  sourceCandidate: MLBOfflineMultiCandidate,
): boolean {
  const selectedCandidateId = typeof selected.candidateId === 'string' ? selected.candidateId : '';
  const selectedLegCount = typeof selected.legCount === 'number' ? selected.legCount : 0;
  const selectedMinConfidence = typeof selected.minimumLegConfidence === 'number' ? selected.minimumLegConfidence : 0;
  const selectedMeanConfidence = typeof selected.meanLegConfidence === 'number' ? selected.meanLegConfidence : 0;
  const selectedMaxUncertainty = typeof selected.maximumLegUncertainty === 'number' ? selected.maximumLegUncertainty : 0;

  if (selectedCandidateId !== sourceCandidate.candidateId) return false;
  if (selectedLegCount !== sourceCandidate.legCount) return false;
  if (selectedMinConfidence !== sourceCandidate.minimumLegConfidence) return false;
  if (selectedMeanConfidence !== sourceCandidate.meanLegConfidence) return false;
  if (selectedMaxUncertainty !== sourceCandidate.maximumLegUncertainty) return false;

  const selectedLegs = Array.isArray(selected.legs) ? (selected.legs as unknown[]) : [];
  if (selectedLegs.length !== sourceCandidate.legs.length) return false;

  for (let i = 0; i < selectedLegs.length; i++) {
    const selectedLeg = selectedLegs[i] as Record<string, unknown>;
    const sourceLeg = sourceCandidate.legs[i];
    if (typeof selectedLeg.recommendationId !== 'string' || selectedLeg.recommendationId !== sourceLeg.recommendationId) return false;
    if (typeof selectedLeg.inferenceId !== 'string' || selectedLeg.inferenceId !== sourceLeg.inferenceId) return false;
    if (typeof selectedLeg.snapshotId !== 'string' || selectedLeg.snapshotId !== sourceLeg.snapshotId) return false;
    if (typeof selectedLeg.gameId !== 'string' || selectedLeg.gameId !== sourceLeg.gameId) return false;
    if (typeof selectedLeg.officialDate !== 'string' || selectedLeg.officialDate !== sourceLeg.officialDate) return false;
    if (typeof selectedLeg.dataCutoffAt !== 'string' || selectedLeg.dataCutoffAt !== sourceLeg.dataCutoffAt) return false;
    if (typeof selectedLeg.homeTeamId !== 'string' || selectedLeg.homeTeamId !== sourceLeg.homeTeamId) return false;
    if (typeof selectedLeg.awayTeamId !== 'string' || selectedLeg.awayTeamId !== sourceLeg.awayTeamId) return false;
    if (selectedLeg.recommendedSide !== sourceLeg.recommendedSide) return false;
    if (typeof selectedLeg.recommendedTeamId !== 'string' || selectedLeg.recommendedTeamId !== sourceLeg.recommendedTeamId) return false;
    if (typeof selectedLeg.modelConfidence !== 'number' || selectedLeg.modelConfidence !== sourceLeg.modelConfidence) return false;
    if (typeof selectedLeg.modelUncertainty !== 'number' || selectedLeg.modelUncertainty !== sourceLeg.modelUncertainty) return false;
    if (!isPlainObject(selectedLeg.probabilities)) return false;
    if (
      typeof selectedLeg.probabilities.homeWinProbability !== 'number' ||
      selectedLeg.probabilities.homeWinProbability !== sourceLeg.probabilities.homeWinProbability
    ) {
      return false;
    }
    if (
      typeof selectedLeg.probabilities.awayWinProbability !== 'number' ||
      selectedLeg.probabilities.awayWinProbability !== sourceLeg.probabilities.awayWinProbability
    ) {
      return false;
    }
  }

  return true;
}

export function validateMLBOfflineMultiRecommendationSet(
  proposed: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineMultiRecommendationSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineMultiRecommendationSetIssue[];
    }> {
  const issues: MLBOfflineMultiRecommendationSetIssue[] = [];

  if (!isPlainObject(proposed)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Multi-recommendation set must be a plain object' },
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

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.contractVersion',
      message: 'contractVersion is required',
    });
  } else if (contractVersionResult !== 'accessor') {
    const contractVersion = (contractVersionResult as { kind: 'data'; value: unknown }).value;
    if (contractVersion !== MLB_OFFLINE_MULTI_RECOMMENDATION_SET_CONTRACT_VERSION) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.contractVersion',
        message: `contractVersion must be ${MLB_OFFLINE_MULTI_RECOMMENDATION_SET_CONTRACT_VERSION}`,
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

  let multiRecommendationSetId: string | null = null;
  const multiRecommendationSetIdResult = ownDataProperty(
    root,
    'multiRecommendationSetId',
    '$.multiRecommendationSetId',
    issues,
  );
  if (multiRecommendationSetIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.multiRecommendationSetId',
      message: 'multiRecommendationSetId is required',
    });
  } else if (multiRecommendationSetIdResult !== 'accessor') {
    const rawValue = (multiRecommendationSetIdResult as { kind: 'data'; value: unknown }).value;
    if (typeof rawValue === 'string') {
      multiRecommendationSetId = rawValue;
      if (!isStrictNonEmptyTrimmedString(multiRecommendationSetId)) {
        issues.push({
          code: 'INVALID_STRING',
          path: '$.multiRecommendationSetId',
          message: 'multiRecommendationSetId must be a valid identifier',
        });
      }
    } else {
      issues.push({
        code: 'INVALID_STRING',
        path: '$.multiRecommendationSetId',
        message: 'multiRecommendationSetId must be a valid identifier',
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

  const selectionPolicyResult = ownDataProperty(root, 'selectionPolicy', '$.selectionPolicy', issues);
  if (selectionPolicyResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.selectionPolicy',
      message: 'selectionPolicy is required',
    });
  } else if (selectionPolicyResult !== 'accessor') {
    const selectionPolicy = (selectionPolicyResult as { kind: 'data'; value: unknown }).value;
    if (selectionPolicy !== MLB_OFFLINE_MULTI_RECOMMENDATION_SELECTION_POLICY) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.selectionPolicy',
        message: `selectionPolicy must be ${MLB_OFFLINE_MULTI_RECOMMENDATION_SELECTION_POLICY}`,
      });
    }
  }

  let sourceCandidateSet: MLBOfflineMultiCandidateSet | null = null;
  const sourceCandidateSetResult = ownDataProperty(root, 'sourceCandidateSet', '$.sourceCandidateSet', issues);
  if (sourceCandidateSetResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sourceCandidateSet',
      message: 'sourceCandidateSet is required',
    });
  } else if (sourceCandidateSetResult !== 'accessor') {
    const sourceCandidateSetValue = (sourceCandidateSetResult as { kind: 'data'; value: unknown }).value;
    const sourceValidation = validateMLBOfflineMultiCandidateSet(sourceCandidateSetValue);
    if (!sourceValidation.ok) {
      return {
        ok: false,
        issues: normalizeIssues([
          {
            code: 'SOURCE_CANDIDATE_SET_INVALID',
            path: '$.sourceCandidateSet',
            message: 'Source candidate set is invalid',
          },
        ]),
      };
    }
    sourceCandidateSet = sourceValidation.value;
  }

  const selectedRecommendationCountResult = ownDataProperty(
    root,
    'selectedRecommendationCount',
    '$.selectedRecommendationCount',
    issues,
  );
  let selectedRecommendationCount = 0;
  if (selectedRecommendationCountResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.selectedRecommendationCount',
      message: 'selectedRecommendationCount is required',
    });
  } else if (selectedRecommendationCountResult !== 'accessor') {
    const selectedRecommendationCountValue = (selectedRecommendationCountResult as { kind: 'data'; value: unknown }).value;
    if (typeof selectedRecommendationCountValue !== 'number' || !Number.isSafeInteger(selectedRecommendationCountValue) || selectedRecommendationCountValue < 0 || Object.is(selectedRecommendationCountValue, -0)) {
      issues.push({
        code: 'INVALID_NUMBER',
        path: '$.selectedRecommendationCount',
        message: 'selectedRecommendationCount must be a non-negative safe integer',
      });
    } else {
      selectedRecommendationCount = selectedRecommendationCountValue;
    }
  }

  const selectedRecommendationIdsResult = ownDataProperty(
    root,
    'selectedRecommendationIds',
    '$.selectedRecommendationIds',
    issues,
  );
  let selectedIds: string[] = [];
  let selectedIdsValid = true;
  if (selectedRecommendationIdsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.selectedRecommendationIds',
      message: 'selectedRecommendationIds is required',
    });
    selectedIdsValid = false;
  } else if (selectedRecommendationIdsResult !== 'accessor') {
    const selectedIdsValue = (selectedRecommendationIdsResult as { kind: 'data'; value: unknown }).value;
    if (Array.isArray(selectedIdsValue)) {
      if (!validateArrayDescriptor(selectedIdsValue, '$.selectedRecommendationIds', issues)) {
        selectedIdsValid = false;
      } else {
        const array = selectedIdsValue as unknown[];
        for (let i = 0; i < array.length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(array, `${i}`);
          if (!descriptor || !isDataDescriptor(descriptor)) {
            continue;
          }
          const value = descriptor.value;
          if (!isStrictNonEmptyTrimmedString(value)) {
            issues.push({
              code: 'INVALID_STRING',
              path: `$.selectedRecommendationIds[${i}]`,
              message: 'selectedRecommendationIds must be valid identifiers',
            });
            selectedIdsValid = false;
          } else {
            selectedIds.push(value);
          }
        }
      }
    } else {
      issues.push({
        code: 'INVALID_ARRAY',
        path: '$.selectedRecommendationIds',
        message: 'selectedRecommendationIds must be an array',
      });
      selectedIdsValid = false;
    }
  }

  const selectedRecommendationsResult = ownDataProperty(
    root,
    'selectedRecommendations',
    '$.selectedRecommendations',
    issues,
  );
  let selectedRecommendations: MLBOfflineSelectedRecommendation[] = [];
  const selectedRecommendationsReadonly = selectedRecommendations as MLBOfflineSelectedRecommendation[] | readonly MLBOfflineSelectedRecommendation[];
  let selectedRecommendationsValid = true;
  if (selectedRecommendationsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.selectedRecommendations',
      message: 'selectedRecommendations is required',
    });
    selectedRecommendationsValid = false;
  } else if (selectedRecommendationsResult !== 'accessor') {
    const selectedRecommendationsValue = (selectedRecommendationsResult as { kind: 'data'; value: unknown }).value;
    if (Array.isArray(selectedRecommendationsValue)) {
      if (!validateArrayDescriptor(selectedRecommendationsValue, '$.selectedRecommendations', issues)) {
        selectedRecommendationsValid = false;
      } else {
        const array = selectedRecommendationsValue as unknown[];
        const seenIds = new Set<string>();
        for (let i = 0; i < array.length; i++) {
          const selectedValue = array[i];
          const selectedPrefix = `$.selectedRecommendations[${i}]`;

          if (!isPlainObject(selectedValue)) {
            issues.push({
              code: 'SELECTED_RECOMMENDATION_INVALID',
              path: selectedPrefix,
              message: 'Selected recommendation must be a plain object',
            });
            selectedRecommendationsValid = false;
            continue;
          }

          const selectedRoot = selectedValue as Record<string, unknown>;

          if (Object.getOwnPropertySymbols(selectedRoot).length > 0) {
            issues.push({
              code: 'SELECTED_RECOMMENDATION_INVALID',
              path: selectedPrefix,
              message: 'Unknown symbol property',
            });
            selectedRecommendationsValid = false;
            continue;
          }

          const unknownFields: string[] = [];
          const prohibitedFields: string[] = [];
          for (const key of Object.getOwnPropertyNames(selectedRoot)) {
            if (!KNOWN_SELECTED_FIELDS.has(key)) {
              if (PROHIBITED_SELECTED_FIELDS.has(key)) {
                prohibitedFields.push(key);
              } else {
                unknownFields.push(key);
              }
            }
          }

          if (unknownFields.length > 0 || prohibitedFields.length > 0) {
            if (unknownFields.length > 0) {
              issues.push({
                code: 'SELECTED_RECOMMENDATION_INVALID',
                path: selectedPrefix,
                message: `Unknown field: ${unknownFields[0]}`,
              });
            }
            if (prohibitedFields.length > 0) {
              issues.push({
                code: 'SELECTED_RECOMMENDATION_INVALID',
                path: selectedPrefix,
                message: `Prohibited field: ${prohibitedFields[0]}`,
              });
            }
            selectedRecommendationsValid = false;
            continue;
          }

          let hasAccessor = false;
          for (const key of Object.getOwnPropertyNames(selectedRoot)) {
            const descriptor = Object.getOwnPropertyDescriptor(selectedRoot, key);
            if (descriptor && !isDataDescriptor(descriptor)) {
              hasAccessor = true;
              break;
            }
          }
          if (hasAccessor) {
            issues.push({
              code: 'SELECTED_RECOMMENDATION_INVALID',
              path: selectedPrefix,
              message: 'Accessor property',
            });
            selectedRecommendationsValid = false;
            continue;
          }

          const selectedCandidateIdResult = ownDataProperty(selectedRoot, 'candidateId', `${selectedPrefix}.candidateId`, issues);
          let selectedCandidateId: unknown | null = null;
          if (selectedCandidateIdResult !== 'missing' && selectedCandidateIdResult !== 'accessor') {
            selectedCandidateId = (selectedCandidateIdResult as { kind: 'data'; value: unknown }).value;
          }

          if (!isStrictNonEmptyTrimmedString(selectedCandidateId)) {
            issues.push({
              code: 'SELECTED_RECOMMENDATION_INVALID',
              path: selectedPrefix,
              message: 'candidateId must be a valid identifier',
            });
            selectedRecommendationsValid = false;
            continue;
          }

          if (seenIds.has(selectedCandidateId as string)) {
            issues.push({
              code: 'DUPLICATE_SELECTED_RECOMMENDATION_ID',
              path: `${selectedPrefix}.candidateId`,
              message: `Duplicate selected recommendationId: ${selectedCandidateId}`,
            });
            selectedRecommendationsValid = false;
            continue;
          }
          seenIds.add(selectedCandidateId as string);

          if (!sourceCandidateSet) {
            issues.push({
              code: 'SELECTED_RECOMMENDATION_INVALID',
              path: selectedPrefix,
              message: 'Source candidate set is missing',
            });
            selectedRecommendationsValid = false;
            continue;
          }

          const sourceCandidate = sourceCandidateSet.candidates.find((c) => c.candidateId === selectedCandidateId);
          if (!sourceCandidate) {
            issues.push({
              code: 'SELECTED_RECOMMENDATION_INVALID',
              path: selectedPrefix,
              message: `Unknown candidateId: ${selectedCandidateId}`,
            });
            selectedRecommendationsValid = false;
            continue;
          }

          if (!isSelectedSourceEquivalent(selectedRoot, sourceCandidate)) {
            issues.push({
              code: 'SELECTED_RECOMMENDATION_INVALID',
              path: selectedPrefix,
              message: `Selected recommendation does not match source candidate: ${selectedCandidateId}`,
            });
            selectedRecommendationsValid = false;
            continue;
          }

          selectedRecommendations.push(selectedRoot as MLBOfflineSelectedRecommendation);
        }
      }
    } else {
      issues.push({
        code: 'INVALID_ARRAY',
        path: '$.selectedRecommendations',
        message: 'selectedRecommendations must be an array',
      });
      selectedRecommendationsValid = false;
    }
  }

  if (selectedRecommendationsValid && selectedIdsValid && typeof selectedRecommendationCount === 'number') {
    if (selectedRecommendationCount !== selectedRecommendations.length) {
      issues.push({
        code: 'SELECTED_RECOMMENDATION_COUNT_MISMATCH',
        path: '$.selectedRecommendationCount',
        message: 'selectedRecommendationCount must equal selected arrays length',
      });
    }

    for (let i = 0; i < selectedRecommendations.length; i++) {
      const selected = selectedRecommendations[i];
      const id = selectedIds[i];
      if (selected.candidateId !== id) {
        issues.push({
          code: 'SELECTED_RECOMMENDATION_ID_MISMATCH',
          path: `$.selectedRecommendationIds[${i}]`,
          message: 'selectedRecommendationIds must map selectedRecommendations by candidateId',
        });
      }
    }
  }

  if (typeof multiRecommendationSetId === 'string' && typeof candidateSetId === 'string') {
    const expectedSetId = candidateSetId + '::offline-multi-recommendation-set-v1';
    if (multiRecommendationSetId !== expectedSetId) {
      issues.push({
        code: 'MULTI_RECOMMENDATION_SET_ID_MISMATCH',
        path: '$.multiRecommendationSetId',
        message: 'multiRecommendationSetId does not match the deterministic formula',
      });
    }
  }

  if (selectedRecommendationsValid && selectedIdsValid && typeof selectedRecommendationCount === 'number') {
    if (selectedRecommendationCount === 0 && selectedRecommendations.length === 0) {
      // valid empty selection
    } else if (selectedRecommendationCount > 0 && selectedRecommendations.length === 0) {
      issues.push({
        code: 'SELECTED_RECOMMENDATION_COMPLETENESS_MISMATCH',
        path: '$.selectedRecommendations',
        message: 'Expected selected recommendations are missing',
      });
    }
  }

  if (sourceCandidateSet && selectedRecommendationsValid && selectedIdsValid && selectedRecommendations.length > 0) {
    const expectedTwoLeg = sourceCandidateSet.candidates.find((c) => c.legCount === 2);
    const expectedThreeLeg = sourceCandidateSet.candidates.find((c) => c.legCount === 3);

    if (expectedTwoLeg || expectedThreeLeg) {
      const hasTwoLeg = selectedRecommendations.some((r) => r.legCount === 2);
      const hasThreeLeg = selectedRecommendations.some((r) => r.legCount === 3);

      if (expectedTwoLeg && !hasTwoLeg) {
        issues.push({
          code: 'SELECTED_RECOMMENDATION_COMPLETENESS_MISMATCH',
          path: '$.selectedRecommendations',
          message: 'Missing first canonical two-leg candidate',
        });
      }

      if (expectedThreeLeg && !hasThreeLeg) {
        issues.push({
          code: 'SELECTED_RECOMMENDATION_COMPLETENESS_MISMATCH',
          path: '$.selectedRecommendations',
          message: 'Missing first canonical three-leg candidate',
        });
      }
    }
  }

  if (selectedRecommendationsValid && selectedIdsValid && selectedRecommendations.length >= 2) {
    const firstIndex = sourceCandidateSet
      ? sourceCandidateSet.candidates.findIndex((c) => c.candidateId === selectedRecommendations[0].candidateId)
      : -1;
    const secondIndex = sourceCandidateSet
      ? sourceCandidateSet.candidates.findIndex((c) => c.candidateId === selectedRecommendations[1].candidateId)
      : -1;

    if (firstIndex >= 0 && secondIndex >= 0 && firstIndex > secondIndex) {
      issues.push({
        code: 'ORDER_MISMATCH',
        path: '$.selectedRecommendations',
        message: 'Selected recommendations must be in source-relative order',
      });
    }
  }

  const finalIssues = normalizeIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: proposed as MLBOfflineMultiRecommendationSet };
}

function selectBestCandidates(
  sourceCandidateSet: MLBOfflineMultiCandidateSet,
): {
  selected: MLBOfflineMultiCandidate[];
  selectedIds: string[];
} {
  let twoLeg: MLBOfflineMultiCandidate | null = null;
  let threeLeg: MLBOfflineMultiCandidate | null = null;

  for (let i = 0; i < sourceCandidateSet.candidates.length; i++) {
    const candidate = sourceCandidateSet.candidates[i];
    if (candidate.legCount === 2 && twoLeg === null) {
      twoLeg = candidate;
    }
    if (candidate.legCount === 3 && threeLeg === null) {
      threeLeg = candidate;
    }
    if (twoLeg !== null && threeLeg !== null) {
      break;
    }
  }

  const selected: MLBOfflineMultiCandidate[] = [];
  const selectedIds: string[] = [];

  if (twoLeg !== null && threeLeg !== null) {
    const twoLegIndex = sourceCandidateSet.candidates.indexOf(twoLeg);
    const threeLegIndex = sourceCandidateSet.candidates.indexOf(threeLeg);
    if (twoLegIndex < threeLegIndex) {
      selected.push(twoLeg);
      selected.push(threeLeg);
      selectedIds.push(twoLeg.candidateId);
      selectedIds.push(threeLeg.candidateId);
    } else {
      selected.push(threeLeg);
      selected.push(twoLeg);
      selectedIds.push(threeLeg.candidateId);
      selectedIds.push(twoLeg.candidateId);
    }
  } else if (twoLeg !== null) {
    selected.push(twoLeg);
    selectedIds.push(twoLeg.candidateId);
  } else if (threeLeg !== null) {
    selected.push(threeLeg);
    selectedIds.push(threeLeg.candidateId);
  }

  return { selected, selectedIds };
}

export function buildMLBOfflineMultiRecommendationSet(
  input: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineMultiRecommendationSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineMultiRecommendationSetIssue[];
    }> {
  const sourceValidation = validateMLBOfflineMultiCandidateSet(input);
  if (!sourceValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_CANDIDATE_SET_INVALID',
          path: '$.candidateSet',
          message: 'Source candidate set is invalid',
        },
      ]),
    };
  }

  const sourceCandidateSet = sourceValidation.value;
  const { selected, selectedIds } = selectBestCandidates(sourceCandidateSet);

  const multiRecommendationSetId =
    sourceCandidateSet.candidateSetId + '::offline-multi-recommendation-set-v1';

  const root = Object.freeze({
    contractVersion: MLB_OFFLINE_MULTI_RECOMMENDATION_SET_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    multiRecommendationSetId,
    candidateSetId: sourceCandidateSet.candidateSetId,
    selectionPolicy: MLB_OFFLINE_MULTI_RECOMMENDATION_SELECTION_POLICY,
    sourceCandidateSet,
    selectedRecommendationCount: selected.length,
    selectedRecommendationIds: Object.freeze(selectedIds) as readonly string[],
    selectedRecommendations: Object.freeze(selected) as readonly MLBOfflineSelectedRecommendation[],
  });

  const validation = validateMLBOfflineMultiRecommendationSet(root);
  if (!validation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'GENERATED_MULTI_RECOMMENDATION_SET_INVALID',
          path: '$',
          message: 'Generated multi-recommendation set failed validation',
        },
      ]),
    };
  }

  return { ok: true, value: root };
}
