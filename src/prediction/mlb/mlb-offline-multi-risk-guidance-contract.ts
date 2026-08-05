import { assertNoOddsContamination, isProhibitedOddsBoundaryKey } from '../firewall/odds-contamination-guard';
import {
  type MLBOfflineMultiRecommendationSet,
  validateMLBOfflineMultiRecommendationSet,
} from './mlb-offline-multi-recommendation-contract';

export const MLB_OFFLINE_MULTI_RISK_GUIDANCE_SET_CONTRACT_VERSION =
  'mlb-offline-multi-risk-guidance-set-v1' as const;

export const MLB_OFFLINE_MULTI_RISK_GUIDANCE_POLICY =
  'MODEL_CONFIDENCE_CONCENTRATION_RISK_UNITS_V1' as const;

export type MLBOfflineRiskGuidanceEntry = Readonly<{
  guidanceEntryId: string;
  candidateId: string;
  baseRiskUnits: number;
  sharedRecommendationIds: readonly string[];
  overlapAdjustmentUnits: number;
  portfolioCapAdjustmentUnits: number;
  recommendedRiskUnits: number;
}>;

export type MLBOfflineMultiRiskGuidanceSet = Readonly<{
  contractVersion: typeof MLB_OFFLINE_MULTI_RISK_GUIDANCE_SET_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  riskGuidanceSetId: string;
  multiRecommendationSetId: string;
  policy: typeof MLB_OFFLINE_MULTI_RISK_GUIDANCE_POLICY;
  sourceMultiRecommendationSet: MLBOfflineMultiRecommendationSet;
  guidanceEntryCount: number;
  guidanceEntryIds: readonly string[];
  guidanceEntries: readonly MLBOfflineRiskGuidanceEntry[];
  portfolioTotalRiskUnits: number;
}>;

export type MLBOfflineMultiRiskGuidanceSetIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'SOURCE_MULTI_RECOMMENDATION_SET_INVALID'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'GUIDANCE_ENTRY_INVALID'
    | 'DUPLICATE_GUIDANCE_ENTRY_ID'
    | 'GUIDANCE_ENTRY_ID_MISMATCH'
    | 'ORDER_MISMATCH'
    | 'RISK_GUIDANCE_SET_ID_MISMATCH'
    | 'GUIDANCE_ENTRY_COUNT_MISMATCH'
    | 'GUIDANCE_COMPLETENESS_MISMATCH'
    | 'BASE_RISK_UNITS_MISMATCH'
    | 'SHARED_RECOMMENDATION_IDS_MISMATCH'
    | 'OVERLAP_ADJUSTMENT_MISMATCH'
    | 'PORTFOLIO_CAP_ADJUSTMENT_MISMATCH'
    | 'RECOMMENDED_RISK_UNITS_MISMATCH'
    | 'PORTFOLIO_TOTAL_MISMATCH'
    | 'PORTFOLIO_CAP_VIOLATION'
    | 'GENERATED_RISK_GUIDANCE_SET_INVALID'
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
  issues: MLBOfflineMultiRiskGuidanceSetIssue[],
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
  issues: MLBOfflineMultiRiskGuidanceSetIssue[],
  issue: MLBOfflineMultiRiskGuidanceSetIssue,
): void {
  const exists = issues.some(
    (item) => item.path === issue.path && item.code === issue.code,
  );
  if (!exists) {
    issues.push(issue);
  }
}

function normalizeIssues(
  issues: MLBOfflineMultiRiskGuidanceSetIssue[],
): MLBOfflineMultiRiskGuidanceSetIssue[] {
  const unique = new Map<string, MLBOfflineMultiRiskGuidanceSetIssue>();
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

function isStructuralInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0 &&
    !Object.is(value, -0)
  );
}

const KNOWN_SET_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'riskGuidanceSetId',
  'multiRecommendationSetId',
  'policy',
  'sourceMultiRecommendationSet',
  'guidanceEntryCount',
  'guidanceEntryIds',
  'guidanceEntries',
  'portfolioTotalRiskUnits',
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

const KNOWN_ENTRY_FIELDS = new Set([
  'guidanceEntryId',
  'candidateId',
  'baseRiskUnits',
  'sharedRecommendationIds',
  'overlapAdjustmentUnits',
  'portfolioCapAdjustmentUnits',
  'recommendedRiskUnits',
]);

const PROHIBITED_ENTRY_FIELDS = new Set([
  'legCount',
  'minimumLegConfidence',
  'meanLegConfidence',
  'maximumLegUncertainty',
  'legs',
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
  'riskTier',
  'overlapCount',
  'monetaryStake',
  'currency',
  'bankroll',
]);

function validateObjectFields(
  root: Record<string, unknown>,
  known: Set<string>,
  prohibited: Set<string>,
  prefix: string,
  issues: MLBOfflineMultiRiskGuidanceSetIssue[],
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
          message: 'Prohibited concept detected',
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
  issues: MLBOfflineMultiRiskGuidanceSetIssue[],
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
          message: 'Prohibited concept detected',
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

function computeMinimumConfidenceBand(minimumLegConfidence: number): number {
  if (minimumLegConfidence >= 0.9) return 5;
  if (minimumLegConfidence >= 0.8) return 4;
  if (minimumLegConfidence >= 0.7) return 3;
  if (minimumLegConfidence >= 0.6) return 2;
  return 1;
}

function computeMeanConfidenceBonus(
  minimumLegConfidence: number,
  meanLegConfidence: number,
): number {
  const minimumBand = computeMinimumConfidenceBand(minimumLegConfidence);
  const meanBand = computeMinimumConfidenceBand(meanLegConfidence);
  return meanBand > minimumBand ? 1 : 0;
}

function computeBaseRiskUnits(
  minimumLegConfidence: number,
  meanLegConfidence: number,
  legCount: 2 | 3,
): number {
  const minimumBand = computeMinimumConfidenceBand(minimumLegConfidence);
  const meanBonus = computeMeanConfidenceBonus(minimumLegConfidence, meanLegConfidence);
  const legPenalty = legCount === 3 ? 1 : 0;
  const base = minimumBand + meanBonus - legPenalty;
  return Math.max(0, Math.min(5, base));
}

function computeOverlapAdjustment(
  baseRiskUnits: number,
  sharedRecommendationIds: readonly string[],
): number {
  return Math.min(baseRiskUnits, sharedRecommendationIds.length);
}

function computeRecommendedRiskUnits(
  baseRiskUnits: number,
  overlapAdjustmentUnits: number,
  portfolioCapAdjustmentUnits: number,
): number {
  return Math.max(0, baseRiskUnits - overlapAdjustmentUnits - portfolioCapAdjustmentUnits);
}

function buildGuidanceEntryId(candidateId: string): string {
  return `${candidateId}::offline-risk-guidance-entry-v1`;
}

function buildRiskGuidanceSetId(multiRecommendationSetId: string): string {
  return `${multiRecommendationSetId}::offline-multi-risk-guidance-set-v1`;
}

function buildCanonicalGuidanceEntries(
  selectedRecommendations: MLBOfflineMultiRecommendationSet['selectedRecommendations'],
): {
  entries: MLBOfflineRiskGuidanceEntry[];
  portfolioTotalRiskUnits: number;
} {
  const entries: MLBOfflineRiskGuidanceEntry[] = [];
  const selectedIdSet = new Set<string>();
  let totalRecommended = 0;

  for (let i = 0; i < selectedRecommendations.length; i++) {
    const candidate = selectedRecommendations[i];
    const recommendationIds = candidate.legs
      .map((leg) => leg.recommendationId)
      .slice()
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const sharedRecommendationIds: string[] = [];
    for (const recommendationId of recommendationIds) {
      if (selectedIdSet.has(recommendationId)) {
        sharedRecommendationIds.push(recommendationId);
      }
    }
    for (const recommendationId of recommendationIds) {
      selectedIdSet.add(recommendationId);
    }

    const baseRiskUnits = computeBaseRiskUnits(
      candidate.minimumLegConfidence,
      candidate.meanLegConfidence,
      candidate.legCount,
    );
    const overlapAdjustmentUnits = computeOverlapAdjustment(baseRiskUnits, sharedRecommendationIds);
    const preCapUnits = baseRiskUnits - overlapAdjustmentUnits;
    const portfolioCapAdjustmentUnits = 0;
    const recommendedRiskUnits = computeRecommendedRiskUnits(
      baseRiskUnits,
      overlapAdjustmentUnits,
      portfolioCapAdjustmentUnits,
    );

    entries.push(
      Object.freeze({
        guidanceEntryId: buildGuidanceEntryId(candidate.candidateId),
        candidateId: candidate.candidateId,
        baseRiskUnits,
        sharedRecommendationIds: Object.freeze(sharedRecommendationIds) as readonly string[],
        overlapAdjustmentUnits,
        portfolioCapAdjustmentUnits,
        recommendedRiskUnits,
      }),
    );

    totalRecommended += recommendedRiskUnits;
  }

  if (totalRecommended > 6) {
    let remainingExcess = totalRecommended - 6;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (remainingExcess <= 0) break;
      const entry = entries[i];
      const preCap = entry.baseRiskUnits - entry.overlapAdjustmentUnits;
      const adjustment = Math.min(preCap, remainingExcess);
      const newRecommended = entry.recommendedRiskUnits - adjustment;
      entries[i] = Object.freeze({
        ...entry,
        portfolioCapAdjustmentUnits: entry.portfolioCapAdjustmentUnits + adjustment,
        recommendedRiskUnits: newRecommended,
      });
      remainingExcess -= adjustment;
    }
  }

  return {
    entries,
    portfolioTotalRiskUnits: entries.reduce(
      (sum, entry) => sum + entry.recommendedRiskUnits,
      0,
    ),
  };
}

export function validateMLBOfflineMultiRiskGuidanceSet(
  proposed: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineMultiRiskGuidanceSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineMultiRiskGuidanceSetIssue[];
    }> {
  const issues: MLBOfflineMultiRiskGuidanceSetIssue[] = [];

  if (!isPlainObject(proposed)) {
    return {
      ok: false,
      issues: normalizeIssues([
        { code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Risk-guidance set must be a plain object' },
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

  let rootHasUnknownOrProhibitedField = false;

  for (const key of Object.getOwnPropertyNames(root)) {
    if (!KNOWN_SET_FIELDS.has(key)) {
      rootHasUnknownOrProhibitedField = true;
      if (PROHIBITED_SET_FIELDS.has(key)) {
        pushUniqueIssue(issues, {
          code: 'PROHIBITED_CONCEPT',
          path: `$.${key}`,
          message: 'Prohibited concept detected',
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
    if (contractVersion !== MLB_OFFLINE_MULTI_RISK_GUIDANCE_SET_CONTRACT_VERSION) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.contractVersion',
        message: `contractVersion must be ${MLB_OFFLINE_MULTI_RISK_GUIDANCE_SET_CONTRACT_VERSION}`,
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

  let riskGuidanceSetId: string | null = null;
  const riskGuidanceSetIdResult = ownDataProperty(
    root,
    'riskGuidanceSetId',
    '$.riskGuidanceSetId',
    issues,
  );
  if (riskGuidanceSetIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.riskGuidanceSetId',
      message: 'riskGuidanceSetId is required',
    });
  } else if (riskGuidanceSetIdResult !== 'accessor') {
    const rawValue = (riskGuidanceSetIdResult as { kind: 'data'; value: unknown }).value;
    if (typeof rawValue === 'string') {
      riskGuidanceSetId = rawValue;
      if (!isStrictNonEmptyTrimmedString(riskGuidanceSetId)) {
        issues.push({
          code: 'INVALID_STRING',
          path: '$.riskGuidanceSetId',
          message: 'riskGuidanceSetId must be a valid identifier',
        });
      }
    } else {
      issues.push({
        code: 'INVALID_STRING',
        path: '$.riskGuidanceSetId',
        message: 'riskGuidanceSetId must be a valid identifier',
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

  const policyResult = ownDataProperty(root, 'policy', '$.policy', issues);
  if (policyResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.policy',
      message: 'policy is required',
    });
  } else if (policyResult !== 'accessor') {
    const policy = (policyResult as { kind: 'data'; value: unknown }).value;
    if (policy !== MLB_OFFLINE_MULTI_RISK_GUIDANCE_POLICY) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.policy',
        message: `policy must be ${MLB_OFFLINE_MULTI_RISK_GUIDANCE_POLICY}`,
      });
    }
  }

  let sourceMultiRecommendationSet: MLBOfflineMultiRecommendationSet | null = null;
  const sourceMultiRecommendationSetResult = ownDataProperty(
    root,
    'sourceMultiRecommendationSet',
    '$.sourceMultiRecommendationSet',
    issues,
  );
  if (sourceMultiRecommendationSetResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sourceMultiRecommendationSet',
      message: 'sourceMultiRecommendationSet is required',
    });
  } else if (sourceMultiRecommendationSetResult !== 'accessor') {
    const sourceValue = (sourceMultiRecommendationSetResult as { kind: 'data'; value: unknown }).value;
    const sourceValidation = validateMLBOfflineMultiRecommendationSet(sourceValue);
    if (!sourceValidation.ok) {
      return {
        ok: false,
        issues: normalizeIssues([
          {
            code: 'SOURCE_MULTI_RECOMMENDATION_SET_INVALID',
            path: '$.sourceMultiRecommendationSet',
            message: 'Source multi-recommendation set is invalid',
          },
        ]),
      };
    }
    sourceMultiRecommendationSet = sourceValidation.value;
  }

  const guidanceEntryCountResult = ownDataProperty(
    root,
    'guidanceEntryCount',
    '$.guidanceEntryCount',
    issues,
  );
  let guidanceEntryCount = 0;
  if (guidanceEntryCountResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.guidanceEntryCount',
      message: 'guidanceEntryCount is required',
    });
  } else if (guidanceEntryCountResult !== 'accessor') {
    const guidanceEntryCountValue = (guidanceEntryCountResult as { kind: 'data'; value: unknown }).value;
    if (typeof guidanceEntryCountValue !== 'number' || !Number.isSafeInteger(guidanceEntryCountValue) || guidanceEntryCountValue < 0 || Object.is(guidanceEntryCountValue, -0)) {
      issues.push({
        code: 'INVALID_NUMBER',
        path: '$.guidanceEntryCount',
        message: 'guidanceEntryCount must be a non-negative safe integer',
      });
    } else {
      guidanceEntryCount = guidanceEntryCountValue;
    }
  }

  const guidanceEntryIdsResult = ownDataProperty(
    root,
    'guidanceEntryIds',
    '$.guidanceEntryIds',
    issues,
  );
  let guidanceEntryIds: string[] = [];
  let guidanceEntryIdsValid = true;
  if (guidanceEntryIdsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.guidanceEntryIds',
      message: 'guidanceEntryIds is required',
    });
    guidanceEntryIdsValid = false;
  } else if (guidanceEntryIdsResult !== 'accessor') {
    const guidanceEntryIdsValue = (guidanceEntryIdsResult as { kind: 'data'; value: unknown }).value;
    if (Array.isArray(guidanceEntryIdsValue)) {
      if (!validateArrayDescriptor(guidanceEntryIdsValue, '$.guidanceEntryIds', issues)) {
        guidanceEntryIdsValid = false;
      } else {
        const array = guidanceEntryIdsValue as unknown[];
        for (let i = 0; i < array.length; i++) {
          const descriptor = Object.getOwnPropertyDescriptor(array, `${i}`);
          if (!descriptor || !isDataDescriptor(descriptor)) {
            continue;
          }
          const value = descriptor.value;
          if (!isStrictNonEmptyTrimmedString(value)) {
            issues.push({
              code: 'INVALID_STRING',
              path: `$.guidanceEntryIds[${i}]`,
              message: 'guidanceEntryIds must be valid identifiers',
            });
            guidanceEntryIdsValid = false;
          } else {
            guidanceEntryIds.push(value);
          }
        }
      }
    } else {
      issues.push({
        code: 'INVALID_ARRAY',
        path: '$.guidanceEntryIds',
        message: 'guidanceEntryIds must be an array',
      });
      guidanceEntryIdsValid = false;
    }
  }

  const guidanceEntriesResult = ownDataProperty(
    root,
    'guidanceEntries',
    '$.guidanceEntries',
    issues,
  );
  let guidanceEntries: MLBOfflineRiskGuidanceEntry[] = [];
  const sourceCandidates: (MLBOfflineMultiRecommendationSet['selectedRecommendations'][number] | null)[] = [];
  let guidanceEntriesValid = true;
  if (guidanceEntriesResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.guidanceEntries',
      message: 'guidanceEntries is required',
    });
    guidanceEntriesValid = false;
  } else if (guidanceEntriesResult !== 'accessor') {
    const guidanceEntriesValue = (guidanceEntriesResult as { kind: 'data'; value: unknown }).value;
    if (Array.isArray(guidanceEntriesValue)) {
      if (!validateArrayDescriptor(guidanceEntriesValue, '$.guidanceEntries', issues)) {
        guidanceEntriesValid = false;
      } else {
        const array = guidanceEntriesValue as unknown[];
        const seenEntryIds = new Set<string>();
        for (let i = 0; i < array.length; i++) {
          const entryValue = array[i];
          const entryPrefix = `$.guidanceEntries[${i}]`;

          if (!isPlainObject(entryValue)) {
            issues.push({
              code: 'GUIDANCE_ENTRY_INVALID',
              path: entryPrefix,
              message: 'Guidance entry must be a plain object',
            });
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }

          const entryRoot = entryValue as Record<string, unknown>;

          if (Object.getOwnPropertySymbols(entryRoot).length > 0) {
            issues.push({
              code: 'GUIDANCE_ENTRY_INVALID',
              path: entryPrefix,
              message: 'Unknown symbol property',
            });
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }

          const unknownFields: string[] = [];
          const prohibitedFields: string[] = [];
          for (const key of Object.getOwnPropertyNames(entryRoot)) {
            if (!KNOWN_ENTRY_FIELDS.has(key)) {
              if (PROHIBITED_ENTRY_FIELDS.has(key)) {
                prohibitedFields.push(key);
              } else {
                unknownFields.push(key);
              }
            }
          }

          if (unknownFields.length > 0 || prohibitedFields.length > 0) {
            if (unknownFields.length > 0) {
              issues.push({
                code: 'GUIDANCE_ENTRY_INVALID',
                path: entryPrefix,
                message: `Unknown field: ${unknownFields[0]}`,
              });
            }
            if (prohibitedFields.length > 0) {
              issues.push({
                code: 'GUIDANCE_ENTRY_INVALID',
                path: entryPrefix,
                message: 'Prohibited concept detected',
              });
            }
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }

          let hasAccessor = false;
          for (const key of Object.getOwnPropertyNames(entryRoot)) {
            const descriptor = Object.getOwnPropertyDescriptor(entryRoot, key);
            if (descriptor && !isDataDescriptor(descriptor)) {
              hasAccessor = true;
              break;
            }
          }
          if (hasAccessor) {
            issues.push({
              code: 'GUIDANCE_ENTRY_INVALID',
              path: entryPrefix,
              message: 'Accessor property',
            });
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }

          const guidanceEntryIdResult = ownDataProperty(entryRoot, 'guidanceEntryId', `${entryPrefix}.guidanceEntryId`, issues);
          let guidanceEntryId: unknown | null = null;
          if (guidanceEntryIdResult !== 'missing' && guidanceEntryIdResult !== 'accessor') {
            guidanceEntryId = (guidanceEntryIdResult as { kind: 'data'; value: unknown }).value;
          }

          const candidateIdResult = ownDataProperty(entryRoot, 'candidateId', `${entryPrefix}.candidateId`, issues);
          let candidateId: unknown | null = null;
          if (candidateIdResult !== 'missing' && candidateIdResult !== 'accessor') {
            candidateId = (candidateIdResult as { kind: 'data'; value: unknown }).value;
          }

          if (!isStrictNonEmptyTrimmedString(guidanceEntryId)) {
            issues.push({
              code: 'GUIDANCE_ENTRY_INVALID',
              path: entryPrefix,
              message: 'guidanceEntryId must be a valid identifier',
            });
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }

          if (!isStrictNonEmptyTrimmedString(candidateId)) {
            issues.push({
              code: 'GUIDANCE_ENTRY_INVALID',
              path: entryPrefix,
              message: 'candidateId must be a valid identifier',
            });
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }

          if (!sourceMultiRecommendationSet) {
            issues.push({
              code: 'GUIDANCE_ENTRY_INVALID',
              path: entryPrefix,
              message: 'Source multi-recommendation set is missing',
            });
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }

          const sourceCandidate = sourceMultiRecommendationSet.selectedRecommendations.find(
            (c) => c.candidateId === candidateId,
          );
          if (!sourceCandidate) {
            issues.push({
              code: 'GUIDANCE_ENTRY_INVALID',
              path: entryPrefix,
              message: `Unknown candidateId: ${candidateId}`,
            });
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }

          const expectedEntryId = buildGuidanceEntryId(candidateId as string);
          if (guidanceEntryId !== expectedEntryId) {
            issues.push({
              code: 'GUIDANCE_ENTRY_ID_MISMATCH',
              path: entryPrefix,
              message: 'Guidance entry ID does not match guidance entry',
            });
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }

          const baseRiskUnitsResult = ownDataProperty(entryRoot, 'baseRiskUnits', `${entryPrefix}.baseRiskUnits`, issues);
          let baseRiskUnits: number | null = null;
          if (baseRiskUnitsResult !== 'missing' && baseRiskUnitsResult !== 'accessor') {
            const value = (baseRiskUnitsResult as { kind: 'data'; value: unknown }).value;
            if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && !Object.is(value, -0)) {
              baseRiskUnits = value;
            } else {
              issues.push({
                code: 'INVALID_NUMBER',
                path: `${entryPrefix}.baseRiskUnits`,
                message: 'baseRiskUnits must be a non-negative integer',
              });
              guidanceEntriesValid = false;
              sourceCandidates.push(null);
              continue;
            }
          }

          const sharedRecommendationIdsResult = ownDataProperty(entryRoot, 'sharedRecommendationIds', `${entryPrefix}.sharedRecommendationIds`, issues);
          let sharedRecommendationIds: string[] = [];
          if (sharedRecommendationIdsResult !== 'missing' && sharedRecommendationIdsResult !== 'accessor') {
            const value = (sharedRecommendationIdsResult as { kind: 'data'; value: unknown }).value;
            if (Array.isArray(value)) {
              if (!validateArrayDescriptor(value, `${entryPrefix}.sharedRecommendationIds`, issues)) {
                guidanceEntriesValid = false;
                sourceCandidates.push(null);
                continue;
              }
              const array = value as unknown[];
              for (let j = 0; j < array.length; j++) {
                const descriptor = Object.getOwnPropertyDescriptor(array, `${j}`);
                if (!descriptor || !isDataDescriptor(descriptor)) {
                  continue;
                }
                const item = descriptor.value;
                if (!isStrictNonEmptyTrimmedString(item)) {
                  issues.push({
                    code: 'INVALID_STRING',
                    path: `${entryPrefix}.sharedRecommendationIds[${j}]`,
                    message: 'sharedRecommendationIds must be valid identifiers',
                  });
                  guidanceEntriesValid = false;
                  continue;
                }
                sharedRecommendationIds.push(item);
              }
            } else {
              issues.push({
                code: 'INVALID_ARRAY',
                path: `${entryPrefix}.sharedRecommendationIds`,
                message: 'sharedRecommendationIds must be an array',
              });
              guidanceEntriesValid = false;
              sourceCandidates.push(null);
              continue;
            }
          }

          const overlapAdjustmentUnitsResult = ownDataProperty(entryRoot, 'overlapAdjustmentUnits', `${entryPrefix}.overlapAdjustmentUnits`, issues);
          let overlapAdjustmentUnits: number | null = null;
          if (overlapAdjustmentUnitsResult !== 'missing' && overlapAdjustmentUnitsResult !== 'accessor') {
            const value = (overlapAdjustmentUnitsResult as { kind: 'data'; value: unknown }).value;
            if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && !Object.is(value, -0)) {
              overlapAdjustmentUnits = value;
            } else {
              issues.push({
                code: 'INVALID_NUMBER',
                path: `${entryPrefix}.overlapAdjustmentUnits`,
                message: 'overlapAdjustmentUnits must be a non-negative integer',
              });
              guidanceEntriesValid = false;
              sourceCandidates.push(null);
              continue;
            }
          }

          const portfolioCapAdjustmentUnitsResult = ownDataProperty(entryRoot, 'portfolioCapAdjustmentUnits', `${entryPrefix}.portfolioCapAdjustmentUnits`, issues);
          let portfolioCapAdjustmentUnits: number | null = null;
          if (portfolioCapAdjustmentUnitsResult !== 'missing' && portfolioCapAdjustmentUnitsResult !== 'accessor') {
            const value = (portfolioCapAdjustmentUnitsResult as { kind: 'data'; value: unknown }).value;
            if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && !Object.is(value, -0)) {
              portfolioCapAdjustmentUnits = value;
            } else {
              issues.push({
                code: 'INVALID_NUMBER',
                path: `${entryPrefix}.portfolioCapAdjustmentUnits`,
                message: 'portfolioCapAdjustmentUnits must be a non-negative integer',
              });
              guidanceEntriesValid = false;
              sourceCandidates.push(null);
              continue;
            }
          }

          const recommendedRiskUnitsResult = ownDataProperty(entryRoot, 'recommendedRiskUnits', `${entryPrefix}.recommendedRiskUnits`, issues);
          let recommendedRiskUnits: number | null = null;
          if (recommendedRiskUnitsResult !== 'missing' && recommendedRiskUnitsResult !== 'accessor') {
            const value = (recommendedRiskUnitsResult as { kind: 'data'; value: unknown }).value;
            if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && !Object.is(value, -0)) {
              recommendedRiskUnits = value;
            } else {
              issues.push({
                code: 'INVALID_NUMBER',
                path: `${entryPrefix}.recommendedRiskUnits`,
                message: 'recommendedRiskUnits must be a non-negative integer',
              });
              guidanceEntriesValid = false;
              sourceCandidates.push(null);
              continue;
            }
          }

          if (seenEntryIds.has(guidanceEntryId as string)) {
            issues.push({
              code: 'DUPLICATE_GUIDANCE_ENTRY_ID',
              path: `${entryPrefix}.guidanceEntryId`,
              message: `Duplicate guidance entry identity`,
            });
            guidanceEntriesValid = false;
            sourceCandidates.push(null);
            continue;
          }
          seenEntryIds.add(guidanceEntryId as string);

          const canonicalBaseRiskUnits = computeBaseRiskUnits(
            sourceCandidate.minimumLegConfidence,
            sourceCandidate.meanLegConfidence,
            sourceCandidate.legCount,
          );

          const canonicalSharedIds = sourceCandidate.legs
            .map((leg) => leg.recommendationId)
            .slice()
            .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

          const selectedIdSet = new Set<string>();
          const canonicalShared: string[] = [];
          const sourceIndex = sourceMultiRecommendationSet.selectedRecommendations.findIndex(
            (c) => c.candidateId === candidateId,
          );
          for (let k = 0; k < sourceIndex; k++) {
            const prevSourceCandidate = sourceMultiRecommendationSet.selectedRecommendations[k];
            for (const id of prevSourceCandidate.legs.map((l) => l.recommendationId)) {
              selectedIdSet.add(id);
            }
          }
          for (const id of canonicalSharedIds) {
            if (selectedIdSet.has(id)) {
              canonicalShared.push(id);
            }
          }

          const canonicalOverlapAdjustment = computeOverlapAdjustment(canonicalBaseRiskUnits, canonicalShared);

          if (baseRiskUnits !== canonicalBaseRiskUnits) {
            issues.push({
              code: 'BASE_RISK_UNITS_MISMATCH',
              path: `${entryPrefix}.baseRiskUnits`,
              message: 'Base risk units do not match the risk policy',
            });
          }

          if (
            sharedRecommendationIds.length !== canonicalShared.length ||
            sharedRecommendationIds.some((id, idx) => id !== canonicalShared[idx])
          ) {
            issues.push({
              code: 'SHARED_RECOMMENDATION_IDS_MISMATCH',
              path: `${entryPrefix}.sharedRecommendationIds`,
              message: 'Shared recommendation IDs do not match incremental overlap',
            });
          }

          if (overlapAdjustmentUnits !== canonicalOverlapAdjustment) {
            issues.push({
              code: 'OVERLAP_ADJUSTMENT_MISMATCH',
              path: `${entryPrefix}.overlapAdjustmentUnits`,
              message: 'Overlap adjustment units do not match shared recommendation exposure',
            });
          }

          guidanceEntries.push({
            guidanceEntryId: guidanceEntryId as string,
            candidateId: candidateId as string,
            baseRiskUnits: baseRiskUnits ?? 0,
            sharedRecommendationIds: sharedRecommendationIds as readonly string[],
            overlapAdjustmentUnits: overlapAdjustmentUnits ?? 0,
            portfolioCapAdjustmentUnits: portfolioCapAdjustmentUnits ?? 0,
            recommendedRiskUnits: recommendedRiskUnits ?? 0,
          });
          sourceCandidates.push(sourceCandidate);
        }
      }
    } else {
      issues.push({
        code: 'INVALID_ARRAY',
        path: '$.guidanceEntries',
        message: 'guidanceEntries must be an array',
      });
      guidanceEntriesValid = false;
    }
  }

  if (guidanceEntryIdsValid && guidanceEntriesValid && typeof guidanceEntryCount === 'number') {
    if (guidanceEntryCount !== guidanceEntryIds.length) {
      issues.push({
        code: 'GUIDANCE_ENTRY_COUNT_MISMATCH',
        path: '$.guidanceEntryCount',
        message: 'Guidance entry count does not match guidance arrays',
      });
    }
    if (guidanceEntryIds.length !== guidanceEntries.length) {
      issues.push({
        code: 'GUIDANCE_ENTRY_COUNT_MISMATCH',
        path: '$.guidanceEntryCount',
        message: 'Guidance entry count does not match guidance arrays',
      });
    }
  }

  if (guidanceEntryIdsValid && guidanceEntriesValid && typeof guidanceEntryCount === 'number') {
    if (guidanceEntryCount !== guidanceEntryIds.length) {
      issues.push({
        code: 'GUIDANCE_ENTRY_COUNT_MISMATCH',
        path: '$.guidanceEntryCount',
        message: 'Guidance entry count does not match guidance arrays',
      });
    }
    if (guidanceEntryIds.length !== guidanceEntries.length) {
      issues.push({
        code: 'GUIDANCE_ENTRY_COUNT_MISMATCH',
        path: '$.guidanceEntryCount',
        message: 'Guidance entry count does not match guidance arrays',
      });
    }
  }

  let canonicalGuidanceEntries: MLBOfflineRiskGuidanceEntry[] = [];
  let canonicalPortfolioTotal = 0;

  if (guidanceEntriesValid && sourceMultiRecommendationSet && !rootHasUnknownOrProhibitedField) {
    for (let i = 0; i < guidanceEntries.length; i++) {
      const entry = guidanceEntries[i];
      const id = guidanceEntryIds[i];
      if (entry.guidanceEntryId !== id) {
        issues.push({
          code: 'GUIDANCE_ENTRY_ID_MISMATCH',
          path: `$.guidanceEntryIds[${i}]`,
          message: 'Guidance entry ID does not match guidance entry',
        });
      }
    }

    const canonicalResult = buildCanonicalGuidanceEntries(
      sourceMultiRecommendationSet.selectedRecommendations,
    );
    canonicalGuidanceEntries = canonicalResult.entries;
    canonicalPortfolioTotal = canonicalResult.portfolioTotalRiskUnits;

    const proposedCandidateIds = new Set(
      guidanceEntries.map((entry) => entry.candidateId),
    );
    const sourceCandidateIds = new Set(
      sourceMultiRecommendationSet.selectedRecommendations.map((c) => c.candidateId),
    );
    if (
      proposedCandidateIds.size !== sourceCandidateIds.size ||
      [...proposedCandidateIds].some((id) => !sourceCandidateIds.has(id))
    ) {
      issues.push({
        code: 'GUIDANCE_COMPLETENESS_MISMATCH',
        path: '$.guidanceEntries',
        message: 'Guidance entries do not match the selected-recommendation universe',
      });
    } else {
      for (let i = 1; i < guidanceEntries.length; i++) {
        const prevIndex = sourceMultiRecommendationSet.selectedRecommendations.findIndex(
          (c) => c.candidateId === guidanceEntries[i - 1].candidateId,
        );
        const currIndex = sourceMultiRecommendationSet.selectedRecommendations.findIndex(
          (c) => c.candidateId === guidanceEntries[i].candidateId,
        );
        if (prevIndex >= 0 && currIndex >= 0 && prevIndex > currIndex) {
          issues.push({
            code: 'ORDER_MISMATCH',
            path: '$.guidanceEntries',
            message: 'Guidance entries are not in source order',
          });
          break;
        }
      }

      const canonicalById = new Map<string, MLBOfflineRiskGuidanceEntry>();
      for (const canonical of canonicalGuidanceEntries) {
        canonicalById.set(canonical.candidateId, canonical);
      }

      for (let i = 0; i < guidanceEntries.length; i++) {
        if (sourceCandidates[i] === null) {
          continue;
        }
        const proposed = guidanceEntries[i];
        const canonical = canonicalById.get(proposed.candidateId);
        if (!canonical) {
          issues.push({
            code: 'GUIDANCE_ENTRY_INVALID',
            path: `$.guidanceEntries[${i}]`,
            message: 'Guidance entry does not match any source candidate',
          });
          continue;
        }
        if (proposed.baseRiskUnits !== canonical.baseRiskUnits) {
          issues.push({
            code: 'BASE_RISK_UNITS_MISMATCH',
            path: `$.guidanceEntries[${i}].baseRiskUnits`,
            message: 'Base risk units do not match the risk policy',
          });
        }
        if (
          proposed.sharedRecommendationIds.length !== canonical.sharedRecommendationIds.length ||
          proposed.sharedRecommendationIds.some((id, idx) => id !== canonical.sharedRecommendationIds[idx])
        ) {
          issues.push({
            code: 'SHARED_RECOMMENDATION_IDS_MISMATCH',
            path: `$.guidanceEntries[${i}].sharedRecommendationIds`,
            message: 'Shared recommendation IDs do not match incremental overlap',
          });
        }
        if (proposed.overlapAdjustmentUnits !== canonical.overlapAdjustmentUnits) {
          issues.push({
            code: 'OVERLAP_ADJUSTMENT_MISMATCH',
            path: `$.guidanceEntries[${i}].overlapAdjustmentUnits`,
            message: 'Overlap adjustment units do not match shared recommendation exposure',
          });
        }
        if (proposed.portfolioCapAdjustmentUnits !== canonical.portfolioCapAdjustmentUnits) {
          issues.push({
            code: 'PORTFOLIO_CAP_ADJUSTMENT_MISMATCH',
            path: `$.guidanceEntries[${i}].portfolioCapAdjustmentUnits`,
            message: 'Portfolio-cap adjustment units do not match deterministic cap reduction',
          });
        }
        if (proposed.recommendedRiskUnits !== canonical.recommendedRiskUnits) {
          issues.push({
            code: 'RECOMMENDED_RISK_UNITS_MISMATCH',
            path: `$.guidanceEntries[${i}].recommendedRiskUnits`,
            message: 'Recommended risk units do not match deterministic calculation',
          });
        }
      }
    }
  }

  if (
    typeof riskGuidanceSetId === 'string' &&
    typeof multiRecommendationSetId === 'string'
  ) {
    const expectedId = buildRiskGuidanceSetId(multiRecommendationSetId);
    if (riskGuidanceSetId !== expectedId) {
      issues.push({
        code: 'RISK_GUIDANCE_SET_ID_MISMATCH',
        path: '$.riskGuidanceSetId',
        message: 'Risk-guidance set ID does not match deterministic identity',
      });
    }
  }

  if (typeof multiRecommendationSetId === 'string' && sourceMultiRecommendationSet) {
    if (multiRecommendationSetId !== sourceMultiRecommendationSet.multiRecommendationSetId) {
      issues.push({
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.multiRecommendationSetId',
        message: 'Root source identity does not match embedded multi-recommendation set',
      });
    }
  }

  if (sourceMultiRecommendationSet) {
    if (root.sport !== sourceMultiRecommendationSet.sport) {
      issues.push({
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.sport',
        message: 'Root source identity does not match embedded multi-recommendation set',
      });
    }
    if (root.target !== sourceMultiRecommendationSet.target) {
      issues.push({
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.target',
        message: 'Root source identity does not match embedded multi-recommendation set',
      });
    }
    if (root.targetEncoding !== sourceMultiRecommendationSet.targetEncoding) {
      issues.push({
        code: 'SOURCE_IDENTITY_MISMATCH',
        path: '$.targetEncoding',
        message: 'Root source identity does not match embedded multi-recommendation set',
      });
    }
  }

  if (guidanceEntriesValid && guidanceEntries.length > 0 && sourceMultiRecommendationSet && !rootHasUnknownOrProhibitedField) {
    const portfolioTotalResult = ownDataProperty(root, 'portfolioTotalRiskUnits', '$.portfolioTotalRiskUnits', issues);
    let portfolioTotal: number | null = null;
    if (portfolioTotalResult !== 'missing' && portfolioTotalResult !== 'accessor') {
      const value = (portfolioTotalResult as { kind: 'data'; value: unknown }).value;
      if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0 && !Object.is(value, -0)) {
        portfolioTotal = value;
      } else {
        issues.push({
          code: 'INVALID_NUMBER',
          path: '$.portfolioTotalRiskUnits',
          message: 'portfolioTotalRiskUnits must be a non-negative integer',
        });
      }
    }

    if (portfolioTotal !== null && portfolioTotal > 6) {
      issues.push({
        code: 'PORTFOLIO_CAP_VIOLATION',
        path: '$.portfolioTotalRiskUnits',
        message: 'Portfolio total risk units exceed the portfolio cap',
      });
    } else if (portfolioTotal !== null && portfolioTotal !== canonicalPortfolioTotal) {
      issues.push({
        code: 'PORTFOLIO_TOTAL_MISMATCH',
        path: '$.portfolioTotalRiskUnits',
        message: 'Portfolio total risk units do not match guidance entries',
      });
    }
  }

  const finalIssues = normalizeIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: proposed as MLBOfflineMultiRiskGuidanceSet };
}

export function buildMLBOfflineMultiRiskGuidanceSet(
  input: unknown,
):
  | Readonly<{
      ok: true;
      value: MLBOfflineMultiRiskGuidanceSet;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOfflineMultiRiskGuidanceSetIssue[];
    }> {
  const sourceValidation = validateMLBOfflineMultiRecommendationSet(input);
  if (!sourceValidation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'SOURCE_MULTI_RECOMMENDATION_SET_INVALID',
          path: '$.multiRecommendationSet',
          message: 'Source multi-recommendation set is invalid',
        },
      ]),
    };
  }

  const sourceMultiRecommendationSet = sourceValidation.value;
  const { entries, portfolioTotalRiskUnits } = buildCanonicalGuidanceEntries(
    sourceMultiRecommendationSet.selectedRecommendations,
  );

  const multiRecommendationSetId = sourceMultiRecommendationSet.multiRecommendationSetId;
  const riskGuidanceSetId = buildRiskGuidanceSetId(multiRecommendationSetId);

  const root = Object.freeze({
    contractVersion: MLB_OFFLINE_MULTI_RISK_GUIDANCE_SET_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    riskGuidanceSetId,
    multiRecommendationSetId,
    policy: MLB_OFFLINE_MULTI_RISK_GUIDANCE_POLICY,
    sourceMultiRecommendationSet,
    guidanceEntryCount: entries.length,
    guidanceEntryIds: Object.freeze(entries.map((e) => e.guidanceEntryId)) as readonly string[],
    guidanceEntries: Object.freeze(entries) as readonly MLBOfflineRiskGuidanceEntry[],
    portfolioTotalRiskUnits,
  });

  const validation = validateMLBOfflineMultiRiskGuidanceSet(root);
  if (!validation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'GENERATED_RISK_GUIDANCE_SET_INVALID',
          path: '$',
          message: 'Generated risk-guidance set failed validation',
        },
      ]),
    };
  }

  return { ok: true, value: root };
}
