import {
  assertNoOddsContamination,
  isProhibitedOddsBoundaryKey,
} from '../firewall/odds-contamination-guard';
import {
  type MLBOfflineRecommendationBundleGrading,
  validateMLBOfflineRecommendationBundleGrading,
} from './mlb-offline-recommendation-bundle-grading-contract';

export const MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION =
  'mlb-offline-performance-aggregation-v1' as const;

const ROOT_FIELDS = [
  'contractVersion',
  'sport',
  'target',
  'targetEncoding',
  'aggregationId',
  'gradingCount',
  'gradingIds',
  'singlePickPerformance',
  'multiPerformance',
  'multiLegPerformance',
  'sourceGradings',
] as const;

const PERFORMANCE_FIELDS = [
  'totalCount',
  'correctCount',
  'incorrectCount',
  'unresolvedCount',
  'resolvedCount',
  'accuracy',
  'resolutionRate',
] as const;

const BUILDER_ROOT_FIELDS = ['gradings'] as const;

const PHASE_8S_PROHIBITED_ROOT_FIELDS = new Set<string>([
  'bankroll',
  'stake',
  'closingLineValue',
  'sportsbookPerformance',
  'oddsBucket',
  'payout',
  'profit',
  'roi',
  'expectedValue',
  'kelly',
]);

export type MLBOfflinePerformanceAggregationInput = Readonly<{
  gradings: unknown;
}>;

export type MLBOfflineSinglePickPerformance = Readonly<{
  totalCount: number;
  correctCount: number;
  incorrectCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  accuracy: number | null;
  resolutionRate: number | null;
}>;

export type MLBOfflineMultiPerformance = Readonly<{
  totalCount: number;
  correctCount: number;
  incorrectCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  accuracy: number | null;
  resolutionRate: number | null;
}>;

export type MLBOfflineMultiLegPerformance = Readonly<{
  totalCount: number;
  correctCount: number;
  incorrectCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  accuracy: number | null;
  resolutionRate: number | null;
}>;

export type MLBOfflinePerformanceAggregation = Readonly<{
  contractVersion: typeof MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  aggregationId: string;
  gradingCount: number;
  gradingIds: readonly string[];
  singlePickPerformance: MLBOfflineSinglePickPerformance;
  multiPerformance: MLBOfflineMultiPerformance;
  multiLegPerformance: MLBOfflineMultiLegPerformance;
  sourceGradings: readonly MLBOfflineRecommendationBundleGrading[];
}>;

export type MLBOfflinePerformanceAggregationIssue = Readonly<{
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
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'SOURCE_GRADING_INVALID'
    | 'DUPLICATE_GRADING_ID'
    | 'DUPLICATE_RECOMMENDATION_BUNDLE_ID'
    | 'SOURCE_GRADING_ORDER_MISMATCH'
    | 'GRADING_COUNT_MISMATCH'
    | 'GRADING_IDS_MISMATCH'
    | 'SINGLE_PICK_PERFORMANCE_MISMATCH'
    | 'MULTI_PERFORMANCE_MISMATCH'
    | 'MULTI_LEG_PERFORMANCE_MISMATCH'
    | 'AGGREGATION_ID_MISMATCH'
    | 'GENERATED_AGGREGATION_INVALID';
  path: string;
  message: string;
}>;

type PerformanceResult = 'CORRECT' | 'INCORRECT' | 'UNRESOLVED';

type SourceGradingValidation =
  | Readonly<{
      ok: true;
      value: MLBOfflineRecommendationBundleGrading;
    }>
  | Readonly<{
      ok: false;
    }>;

function validateSourceGrading(
  proposed: unknown,
): SourceGradingValidation {
  const result = validateMLBOfflineRecommendationBundleGrading(
    proposed,
  );

  if (result.ok) {
    return { ok: true, value: result.value };
  }

  return { ok: false };
}

function hasDuplicateGradingId(
  gradings: readonly MLBOfflineRecommendationBundleGrading[],
): boolean {
  const seen = new Set<string>();

  for (const grading of gradings) {
    const id = grading.gradingId;

    if (seen.has(id)) {
      return true;
    }

    seen.add(id);
  }

  return false;
}

function hasDuplicateRecommendationBundleId(
  gradings: readonly MLBOfflineRecommendationBundleGrading[],
): boolean {
  const seen = new Set<string>();

  for (const grading of gradings) {
    const id = grading.recommendationBundleId;

    if (seen.has(id)) {
      return true;
    }

    seen.add(id);
  }

  return false;
}

function compareGradingsById(
  a: MLBOfflineRecommendationBundleGrading,
  b: MLBOfflineRecommendationBundleGrading,
): number {
  return a.gradingId < b.gradingId
    ? -1
    : a.gradingId > b.gradingId
      ? 1
      : 0;
}

function canonicalizeGradings(
  gradings: readonly MLBOfflineRecommendationBundleGrading[],
): MLBOfflineRecommendationBundleGrading[] {
  return [...gradings].sort(compareGradingsById);
}

function derivePerformanceSummary(
  results: readonly PerformanceResult[],
): Readonly<{
  totalCount: number;
  correctCount: number;
  incorrectCount: number;
  unresolvedCount: number;
  resolvedCount: number;
  accuracy: number | null;
  resolutionRate: number | null;
}> {
  let correctCount = 0;
  let incorrectCount = 0;
  let unresolvedCount = 0;

  for (const result of results) {
    if (result === 'CORRECT') {
      correctCount += 1;
    } else if (result === 'INCORRECT') {
      incorrectCount += 1;
    } else {
      unresolvedCount += 1;
    }
  }

  const totalCount = correctCount + incorrectCount + unresolvedCount;
  const resolvedCount = correctCount + incorrectCount;

  return {
    totalCount,
    correctCount,
    incorrectCount,
    unresolvedCount,
    resolvedCount,
    accuracy: resolvedCount === 0 ? null : correctCount / resolvedCount,
    resolutionRate: totalCount === 0 ? null : resolvedCount / totalCount,
  };
}

function deriveSinglePickPerformance(
  sourceGradings: readonly MLBOfflineRecommendationBundleGrading[],
): MLBOfflineSinglePickPerformance {
  const results: PerformanceResult[] = [];

  for (const grading of sourceGradings) {
    for (const grade of grading.singlePickGrades) {
      results.push(grade.result);
    }
  }

  return derivePerformanceSummary(results);
}

function deriveMultiPerformance(
  sourceGradings: readonly MLBOfflineRecommendationBundleGrading[],
): MLBOfflineMultiPerformance {
  const results: PerformanceResult[] = [];

  for (const grading of sourceGradings) {
    for (const grade of grading.multiGrades) {
      results.push(grade.result);
    }
  }

  return derivePerformanceSummary(results);
}

function deriveMultiLegPerformance(
  sourceGradings: readonly MLBOfflineRecommendationBundleGrading[],
): MLBOfflineMultiLegPerformance {
  const results: PerformanceResult[] = [];

  for (const grading of sourceGradings) {
    for (const multiGrade of grading.multiGrades) {
      for (const legGrade of multiGrade.legGrades) {
        results.push(legGrade.result);
      }
    }
  }

  return derivePerformanceSummary(results);
}

function encodeComponent(value: string): string {
  return `${value.length}:${value}`;
}

function deterministicAggregationId(
  gradingIds: readonly string[],
): string {
  return [
    encodeComponent(
      MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION,
    ),
    encodeComponent(String(gradingIds.length)),
    ...gradingIds.map(encodeComponent),
  ].join('') + '::offline-performance-aggregation-v1';
}

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
  return (
    !!descriptor &&
    Object.prototype.hasOwnProperty.call(descriptor, 'value')
  );
}

function pushUniqueIssue(
  issues: MLBOfflinePerformanceAggregationIssue[],
  issue: MLBOfflinePerformanceAggregationIssue,
): void {
  const exists = issues.some(
    (item) => item.path === issue.path && item.code === issue.code,
  );

  if (!exists) {
    issues.push(issue);
  }
}

function normalizeIssues(
  issues: readonly MLBOfflinePerformanceAggregationIssue[],
): readonly MLBOfflinePerformanceAggregationIssue[] {
  const seen = new Set<string>();
  const normalized: MLBOfflinePerformanceAggregationIssue[] = [];

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

function ownDataProperty(
  target: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBOfflinePerformanceAggregationIssue[],
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

function validatePerformanceSummary(
  proposed: unknown,
  prefix: string,
  expected: Readonly<{
    totalCount: number;
    correctCount: number;
    incorrectCount: number;
    unresolvedCount: number;
    resolvedCount: number;
    accuracy: number | null;
    resolutionRate: number | null;
  }>,
  issues: MLBOfflinePerformanceAggregationIssue[],
): boolean {
  if (!isPlainObject(proposed)) {
    pushUniqueIssue(issues, {
      code: 'INVALID_JSON_VALUE',
      path: prefix,
      message: `${prefix} must be a plain object`,
    });

    return false;
  }

  const summaryRoot = proposed as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(summaryRoot)) {
    pushUniqueIssue(issues, {
      code: 'UNKNOWN_FIELD',
      path: `${prefix}[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  const ownNames = Object.getOwnPropertyNames(summaryRoot);
  for (const key of ownNames) {
    if (!PERFORMANCE_FIELDS.includes(key as (typeof PERFORMANCE_FIELDS)[number])) {
      if (isProhibitedOddsBoundaryKey(key)) {
        pushUniqueIssue(issues, {
          code: 'ODDS_CONTAMINATION',
          path: `${prefix}.${key}`,
          message: 'Odds contamination detected',
        });
      } else if (PHASE_8S_PROHIBITED_ROOT_FIELDS.has(key)) {
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

  for (const field of PERFORMANCE_FIELDS) {
    const fieldPath = `${prefix}.${field}`;
    const fieldResult = ownDataProperty(summaryRoot, field, fieldPath, issues);

    if (fieldResult === 'missing') {
      pushUniqueIssue(issues, {
        code: 'MISSING_FIELD',
        path: fieldPath,
        message: `${field} is required`,
      });

      return false;
    }

    if (fieldResult === 'accessor') {
      return false;
    }
  }

  const countFields = [
    'totalCount',
    'correctCount',
    'incorrectCount',
    'unresolvedCount',
    'resolvedCount',
  ] as const;

  let primitiveValid = true;

  for (const field of countFields) {
    const fieldPath = `${prefix}.${field}`;
    const fieldResult = ownDataProperty(summaryRoot, field, fieldPath, issues);

    if (fieldResult === 'accessor') {
      primitiveValid = false;

      continue;
    }

    const value = (fieldResult as { kind: 'data'; value: unknown }).value;

    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      pushUniqueIssue(issues, {
        code: 'INVALID_INTEGER',
        path: fieldPath,
        message: `${field} must be a non-negative safe integer`,
      });

      primitiveValid = false;
    }
  }

  const rateFields = ['accuracy', 'resolutionRate'] as const;

  for (const field of rateFields) {
    const fieldPath = `${prefix}.${field}`;
    const fieldResult = ownDataProperty(summaryRoot, field, fieldPath, issues);

    if (fieldResult === 'accessor') {
      primitiveValid = false;

      continue;
    }

    const value = (fieldResult as { kind: 'data'; value: unknown }).value;

    if (
      value !== null &&
      (typeof value !== 'number' ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1)
    ) {
      pushUniqueIssue(issues, {
        code: 'INVALID_NUMBER',
        path: fieldPath,
        message: `${field} must be null or a finite number in [0, 1]`,
      });

      primitiveValid = false;
    }
  }

  if (!primitiveValid) {
    return false;
  }

  let mismatch = false;

  for (const field of PERFORMANCE_FIELDS) {
    const expectedValue = expected[field as keyof typeof expected];
    const actualValue = summaryRoot[field as keyof typeof summaryRoot];

    if (expectedValue !== actualValue) {
      mismatch = true;

      break;
    }
  }

  if (mismatch) {
    const fieldName = prefix.replace('$.', '');

    let code: MLBOfflinePerformanceAggregationIssue['code'];

    if (prefix === '$.singlePickPerformance') {
      code = 'SINGLE_PICK_PERFORMANCE_MISMATCH';
    } else if (prefix === '$.multiPerformance') {
      code = 'MULTI_PERFORMANCE_MISMATCH';
    } else {
      code = 'MULTI_LEG_PERFORMANCE_MISMATCH';
    }

    pushUniqueIssue(issues, {
      code,
      path: prefix,
      message: `${fieldName} does not match source gradings`,
    });

    return false;
  }

  return true;
}

export function validateMLBOfflinePerformanceAggregation(
  proposed: unknown,
): Readonly<{
  ok: true;
  value: MLBOfflinePerformanceAggregation;
}> | Readonly<{
  ok: false;
  issues: readonly MLBOfflinePerformanceAggregationIssue[];
}> {
  const issues: MLBOfflinePerformanceAggregationIssue[] = [];

  if (!isPlainObject(proposed)) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'NOT_PLAIN_OBJECT',
          path: '$',
          message: 'Root must be a plain object',
        },
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
          {
            code: 'INVALID_JSON_VALUE',
            path: '$',
            message: 'Uninspectable accessor property',
          },
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

    if (PHASE_8S_PROHIBITED_ROOT_FIELDS.has(key)) {
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

  let contractVersionOk = true;

  const contractVersionResult = ownDataProperty(
    proposedRoot,
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

    contractVersionOk = false;
  } else if (contractVersionResult !== 'accessor') {
    const value = (contractVersionResult as { kind: 'data'; value: unknown }).value;

    if (value !== MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION) {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.contractVersion',
        message: `contractVersion must be ${MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION}`,
      });

      contractVersionOk = false;
    }
  }

  let sportOk = true;

  const sportResult = ownDataProperty(
    proposedRoot,
    'sport',
    '$.sport',
    issues,
  );

  if (sportResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sport',
      message: 'sport is required',
    });

    sportOk = false;
  } else if (sportResult !== 'accessor') {
    const value = (sportResult as { kind: 'data'; value: unknown }).value;

    if (value !== 'MLB') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.sport',
        message: 'sport must be MLB',
      });

      sportOk = false;
    }
  }

  let targetOk = true;

  const targetResult = ownDataProperty(
    proposedRoot,
    'target',
    '$.target',
    issues,
  );

  if (targetResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.target',
      message: 'target is required',
    });

    targetOk = false;
  } else if (targetResult !== 'accessor') {
    const value = (targetResult as { kind: 'data'; value: unknown }).value;

    if (value !== 'OFFICIAL_FINAL_GAME_WINNER') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.target',
        message: 'target must be OFFICIAL_FINAL_GAME_WINNER',
      });

      targetOk = false;
    }
  }

  let targetEncodingOk = true;

  const targetEncodingResult = ownDataProperty(
    proposedRoot,
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

    targetEncodingOk = false;
  } else if (targetEncodingResult !== 'accessor') {
    const value = (targetEncodingResult as { kind: 'data'; value: unknown }).value;

    if (value !== 'HOME_WIN_1_AWAY_WIN_0') {
      pushUniqueIssue(issues, {
        code: 'INVALID_LITERAL',
        path: '$.targetEncoding',
        message: 'targetEncoding must be HOME_WIN_1_AWAY_WIN_0',
      });

      targetEncodingOk = false;
    }
  }

  let aggregationId: string | null = null;

  const aggregationIdResult = ownDataProperty(
    proposedRoot,
    'aggregationId',
    '$.aggregationId',
    issues,
  );

  if (aggregationIdResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.aggregationId',
      message: 'aggregationId is required',
    });
  } else if (aggregationIdResult !== 'accessor') {
    const value = (aggregationIdResult as { kind: 'data'; value: unknown }).value;

    if (typeof value !== 'string' || value.length === 0 || value !== value.trim()) {
      pushUniqueIssue(issues, {
        code: 'INVALID_STRING',
        path: '$.aggregationId',
        message: 'aggregationId must be a valid identifier',
      });
    } else {
      aggregationId = value;
    }
  }

  let gradingCount: number | null = null;

  const gradingCountResult = ownDataProperty(
    proposedRoot,
    'gradingCount',
    '$.gradingCount',
    issues,
  );

  if (gradingCountResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.gradingCount',
      message: 'gradingCount is required',
    });
  } else if (gradingCountResult !== 'accessor') {
    const value = (gradingCountResult as { kind: 'data'; value: unknown }).value;

    if (
      typeof value !== 'number' ||
      !Number.isSafeInteger(value) ||
      value < 0
    ) {
      pushUniqueIssue(issues, {
        code: 'INVALID_INTEGER',
        path: '$.gradingCount',
        message: 'gradingCount must be a non-negative safe integer',
      });
    } else {
      gradingCount = value;
    }
  }

  let gradingIds: string[] | null = null;

  const gradingIdsResult = ownDataProperty(
    proposedRoot,
    'gradingIds',
    '$.gradingIds',
    issues,
  );

  if (gradingIdsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.gradingIds',
      message: 'gradingIds is required',
    });
  } else if (gradingIdsResult !== 'accessor') {
    const value = (gradingIdsResult as { kind: 'data'; value: unknown }).value;

    if (!Array.isArray(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_ARRAY',
        path: '$.gradingIds',
        message: '$.gradingIds must be an array',
      });
    } else {
      const array = value as unknown[];

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
          path: '$.gradingIds',
          message: 'Sparse array',
        });
      }

      if (Object.getOwnPropertySymbols(array).length > 0) {
        pushUniqueIssue(issues, {
          code: 'UNKNOWN_FIELD',
          path: '$.gradingIds[symbol]',
          message: 'Array symbol property',
        });
      }

      let idsValid = true;

      for (let i = 0; i < array.length; i++) {
        const element = array[i];

        if (
          typeof element !== 'string' ||
          element.length === 0 ||
          element !== element.trim()
        ) {
          pushUniqueIssue(issues, {
            code: 'INVALID_STRING',
            path: `$.gradingIds[${i}]`,
            message: 'gradingId must be a valid identifier',
          });

          idsValid = false;
        }
      }

      if (idsValid) {
        gradingIds = array as string[];
      }
    }
  }

  const sourceGradingsResult = ownDataProperty(
    proposedRoot,
    'sourceGradings',
    '$.sourceGradings',
    issues,
  );

  let sourceGradings: MLBOfflineRecommendationBundleGrading[] | null = null;

  if (sourceGradingsResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.sourceGradings',
      message: 'sourceGradings is required',
    });
  } else if (sourceGradingsResult !== 'accessor') {
    const value = (sourceGradingsResult as { kind: 'data'; value: unknown }).value;

    if (!Array.isArray(value)) {
      pushUniqueIssue(issues, {
        code: 'INVALID_ARRAY',
        path: '$.sourceGradings',
        message: 'sourceGradings must be an array',
      });
    } else {
      const array = value as unknown[];

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
          path: '$.sourceGradings',
          message: 'Sparse array',
        });
      }

      if (Object.getOwnPropertySymbols(array).length > 0) {
        pushUniqueIssue(issues, {
          code: 'UNKNOWN_FIELD',
          path: '$.sourceGradings[symbol]',
          message: 'Array symbol property',
        });
      }

      const structurallyValid = !sparse;

      if (structurallyValid && gradingCount !== null) {
        if (gradingCount !== array.length) {
          pushUniqueIssue(issues, {
            code: 'GRADING_COUNT_MISMATCH',
            path: '$.gradingCount',
            message: 'gradingCount does not match sourceGradings',
          });
        }
      }

      if (structurallyValid) {
        const validGradings: MLBOfflineRecommendationBundleGrading[] = [];
        let allValid = true;

        for (let i = 0; i < array.length; i++) {
          const validation = validateSourceGrading(array[i]);

          if (!validation.ok) {
            pushUniqueIssue(issues, {
              code: 'SOURCE_GRADING_INVALID',
              path: `$.sourceGradings[${i}]`,
              message: 'Source recommendation bundle grading failed validation',
            });

            allValid = false;
          } else {
            validGradings.push(validation.value);
          }
        }

        if (allValid) {
          const hasDuplicateGrading = hasDuplicateGradingId(validGradings);
          const hasDuplicateBundle = hasDuplicateRecommendationBundleId(validGradings);

          if (hasDuplicateGrading) {
            pushUniqueIssue(issues, {
              code: 'DUPLICATE_GRADING_ID',
              path: '$.sourceGradings',
              message: 'Duplicate gradingId values are not allowed',
            });
          }

          if (hasDuplicateBundle) {
            pushUniqueIssue(issues, {
              code: 'DUPLICATE_RECOMMENDATION_BUNDLE_ID',
              path: '$.sourceGradings',
              message: 'Duplicate recommendationBundleId values are not allowed',
            });
          }

          const sourceSemanticsValid =
            !hasDuplicateGrading && !hasDuplicateBundle;

          if (sourceSemanticsValid) {
            const canonical = canonicalizeGradings(validGradings);
            const proposedIds = validGradings.map(
              (grading) => grading.gradingId,
            );
            const canonicalIds = canonical.map((grading) => grading.gradingId);

            if (
              proposedIds.length !== canonicalIds.length ||
              proposedIds.some((id, index) => id !== canonicalIds[index])
            ) {
              pushUniqueIssue(issues, {
                code: 'SOURCE_GRADING_ORDER_MISMATCH',
                path: '$.sourceGradings',
                message: 'sourceGradings must be ordered by gradingId ascending',
              });
            }
          }

          if (sourceSemanticsValid && gradingIds !== null) {
            const canonical = canonicalizeGradings(validGradings);
            const expectedIds = canonical.map((grading) => grading.gradingId);

            if (
              gradingIds.length !== expectedIds.length ||
              gradingIds.some((id, index) => id !== expectedIds[index])
            ) {
              pushUniqueIssue(issues, {
                code: 'GRADING_IDS_MISMATCH',
                path: '$.gradingIds',
                message: 'gradingIds do not match canonical sourceGradings',
              });
            }
          }

          sourceGradings = validGradings;
        }
      }
    }
  }

  let singlePickPerformance: MLBOfflineSinglePickPerformance | null = null;
  let multiPerformance: MLBOfflineMultiPerformance | null = null;
  let multiLegPerformance: MLBOfflineMultiLegPerformance | null = null;

  if (sourceGradings !== null) {
    const validGradings = sourceGradings;
    const sourceSemanticsValid =
      !hasDuplicateGradingId(validGradings) &&
      !hasDuplicateRecommendationBundleId(validGradings);

    if (sourceSemanticsValid) {
      singlePickPerformance = deriveSinglePickPerformance(validGradings);
      multiPerformance = deriveMultiPerformance(validGradings);
      multiLegPerformance = deriveMultiLegPerformance(validGradings);
    }
  }

  const singlePickResult = ownDataProperty(
    proposedRoot,
    'singlePickPerformance',
    '$.singlePickPerformance',
    issues,
  );

  if (singlePickResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.singlePickPerformance',
      message: 'singlePickPerformance is required',
    });
  } else if (singlePickResult !== 'accessor') {
    const value = (singlePickResult as { kind: 'data'; value: unknown }).value;

    if (singlePickPerformance !== null) {
      validatePerformanceSummary(
        value,
        '$.singlePickPerformance',
        singlePickPerformance,
        issues,
      );
    }
  }

  const multiResult = ownDataProperty(
    proposedRoot,
    'multiPerformance',
    '$.multiPerformance',
    issues,
  );

  if (multiResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.multiPerformance',
      message: 'multiPerformance is required',
    });
  } else if (multiResult !== 'accessor') {
    const value = (multiResult as { kind: 'data'; value: unknown }).value;

    if (multiPerformance !== null) {
      validatePerformanceSummary(
        value,
        '$.multiPerformance',
        multiPerformance,
        issues,
      );
    }
  }

  const multiLegResult = ownDataProperty(
    proposedRoot,
    'multiLegPerformance',
    '$.multiLegPerformance',
    issues,
  );

  if (multiLegResult === 'missing') {
    pushUniqueIssue(issues, {
      code: 'MISSING_FIELD',
      path: '$.multiLegPerformance',
      message: 'multiLegPerformance is required',
    });
  } else if (multiLegResult !== 'accessor') {
    const value = (multiLegResult as { kind: 'data'; value: unknown }).value;

    if (multiLegPerformance !== null) {
      validatePerformanceSummary(
        value,
        '$.multiLegPerformance',
        multiLegPerformance,
        issues,
      );
    }
  }

  if (sourceGradings !== null && aggregationId !== null) {
    const sourceSemanticsValid =
      !hasDuplicateGradingId(sourceGradings) &&
      !hasDuplicateRecommendationBundleId(sourceGradings);

    if (sourceSemanticsValid) {
      const canonical = canonicalizeGradings(sourceGradings);
      const expectedAggregationId = deterministicAggregationId(
        canonical.map((grading) => grading.gradingId),
      );

      if (aggregationId !== expectedAggregationId) {
        pushUniqueIssue(issues, {
          code: 'AGGREGATION_ID_MISMATCH',
          path: '$.aggregationId',
          message: 'aggregationId does not match canonical source gradings',
        });
      }
    }
  }

  if (issues.length > 0) {
    return {
      ok: false,
      issues: normalizeIssues(issues),
    };
  }

  return {
    ok: true,
    value: proposedRoot as MLBOfflinePerformanceAggregation,
  };
}

export function buildMLBOfflinePerformanceAggregation(
  input: MLBOfflinePerformanceAggregationInput,
): Readonly<{
  ok: true;
  value: MLBOfflinePerformanceAggregation;
}> | Readonly<{
  ok: false;
  issues: readonly MLBOfflinePerformanceAggregationIssue[];
}> {
  const issues: MLBOfflinePerformanceAggregationIssue[] = [];

  const inputRoot = input as Record<string, unknown>;

  for (const symbol of Object.getOwnPropertySymbols(inputRoot)) {
    issues.push({
      code: 'UNKNOWN_FIELD',
      path: `$[${String(symbol)}]`,
      message: 'Unknown symbol property',
    });
  }

  const gradingsResult = ownDataProperty(inputRoot, 'gradings', '$.gradings', issues);

  if (gradingsResult === 'missing') {
    issues.push({
      code: 'MISSING_FIELD',
      path: '$.gradings',
      message: 'gradings is required',
    });

    return {
      ok: false,
      issues: normalizeIssues(issues),
    };
  }

  if (gradingsResult === 'accessor') {
    issues.push({
      code: 'INVALID_JSON_VALUE',
      path: '$.gradings',
      message: 'Accessor property: gradings',
    });

    return {
      ok: false,
      issues: normalizeIssues(issues),
    };
  }

  const gradingsValue = (gradingsResult as { kind: 'data'; value: unknown }).value;

  if (!Array.isArray(gradingsValue)) {
    issues.push({
      code: 'INVALID_ARRAY',
      path: '$.gradings',
      message: 'gradings must be an array',
    });

    return {
      ok: false,
      issues: normalizeIssues(issues),
    };
  }

  const gradingsArray = gradingsValue as unknown[];

  let sparse = false;

  for (let i = 0; i < gradingsArray.length; i++) {
    if (!(i in gradingsArray)) {
      sparse = true;

      break;
    }
  }

  if (sparse) {
    issues.push({
      code: 'INVALID_ARRAY',
      path: '$.gradings',
      message: 'Sparse array',
    });

    return {
      ok: false,
      issues: normalizeIssues(issues),
    };
  }

  if (Object.getOwnPropertySymbols(gradingsArray).length > 0) {
    issues.push({
      code: 'UNKNOWN_FIELD',
      path: '$.gradings[symbol]',
      message: 'Array symbol property',
    });

    return {
      ok: false,
      issues: normalizeIssues(issues),
    };
  }

  const validGradings: MLBOfflineRecommendationBundleGrading[] = [];
  let allValid = true;

  for (let i = 0; i < gradingsArray.length; i++) {
    const validation = validateSourceGrading(gradingsArray[i]);

    if (!validation.ok) {
      pushUniqueIssue(issues, {
        code: 'SOURCE_GRADING_INVALID',
        path: `$.gradings[${i}]`,
        message: 'Source recommendation bundle grading failed validation',
      });

      allValid = false;
    } else {
      validGradings.push(validation.value);
    }
  }

  if (!allValid) {
    return {
      ok: false,
      issues: normalizeIssues(issues),
    };
  }

  if (hasDuplicateGradingId(validGradings)) {
    pushUniqueIssue(issues, {
      code: 'DUPLICATE_GRADING_ID',
      path: '$.gradings',
      message: 'Duplicate gradingId values are not allowed',
    });
  }

  if (hasDuplicateRecommendationBundleId(validGradings)) {
    pushUniqueIssue(issues, {
      code: 'DUPLICATE_RECOMMENDATION_BUNDLE_ID',
      path: '$.gradings',
      message: 'Duplicate recommendationBundleId values are not allowed',
    });
  }

  const sourceSemanticsValid =
    !hasDuplicateGradingId(validGradings) &&
    !hasDuplicateRecommendationBundleId(validGradings);

  if (!sourceSemanticsValid) {
    return {
      ok: false,
      issues: normalizeIssues(issues),
    };
  }

  const canonicalGradings = canonicalizeGradings(validGradings);
  const canonicalGradingIds = canonicalGradings.map((grading) => grading.gradingId);

  const gradingCount = canonicalGradings.length;
  const singlePickPerformance = deriveSinglePickPerformance(canonicalGradings);
  const multiPerformance = deriveMultiPerformance(canonicalGradings);
  const multiLegPerformance = deriveMultiLegPerformance(canonicalGradings);
  const aggregationId = deterministicAggregationId(canonicalGradingIds);

  const root: MLBOfflinePerformanceAggregation = {
    contractVersion: MLB_OFFLINE_PERFORMANCE_AGGREGATION_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    aggregationId,
    gradingCount,
    gradingIds: Object.freeze(canonicalGradingIds),
    singlePickPerformance: Object.freeze(singlePickPerformance),
    multiPerformance: Object.freeze(multiPerformance),
    multiLegPerformance: Object.freeze(multiLegPerformance),
    sourceGradings: Object.freeze(canonicalGradings),
  };

  const frozenRoot = Object.freeze(root);

  const validation = validateMLBOfflinePerformanceAggregation(frozenRoot);

  if (!validation.ok) {
    return {
      ok: false,
      issues: normalizeIssues([
        {
          code: 'GENERATED_AGGREGATION_INVALID',
          path: '$',
          message: 'Generated performance aggregation failed validation',
        },
      ]),
    };
  }

  return { ok: true, value: frozenRoot };
}
