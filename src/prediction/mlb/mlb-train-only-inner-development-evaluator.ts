import { assertNoOddsContamination } from '../firewall/odds-contamination-guard';
import { createHash } from 'node:crypto';
import {
  validateMLBTrainingMatrix,
  type MLBTrainingMatrix,
  type MLBTrainingMatrixRow,
  type MLBTrainingMatrixIssue,
} from './mlb-training-matrix-contract';
import {
  validateMLBTrainOnlyInnerFoldPlan,
  MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN,
  type MLBTrainOnlyInnerFoldPlan,
  type MLBFoldDefinition,
} from './mlb-train-only-inner-fold-plan';
import {
  validateMLBFeatureVector,
  type MLBFeatureVector,
} from './mlb-feature-vector-contract';

export const MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION =
  'mlb-train-only-inner-row-collection-v1' as const;

export const MLB_TRAIN_ONLY_INNER_VALIDATION_FOLDS_CONTRACT_VERSION =
  'mlb-train-only-inner-validation-folds-v1' as const;

export const MLB_INNER_CANDIDATE_RECIPE_FINGERPRINT_CONTRACT_VERSION =
  'mlb-inner-candidate-recipe-fingerprint-v1' as const;

export const MLB_INNER_DEVELOPMENT_CYCLE_ID =
  'mlb-v1-train-only-inner-development-cycle-v1' as const;

export const MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION =
  'mlb-inner-development-recipe-budget-v1' as const;

export type MLBOuterTrainRow = MLBTrainingMatrixRow & Readonly<{ split: 'TRAIN' }>;

export type MLBTrainOnlyInnerRowCollection = Readonly<{
  contractVersion: typeof MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  targetEncoding: 'HOME_WIN_1_AWAY_WIN_0';
  matrixId: string;
  manifestId: string;
  datasetId: string;
  rowCount: number;
  homeWinCount: number;
  awayWinCount: number;
  rows: readonly MLBOuterTrainRow[];
}>;

export type MLBTrainOnlyInnerRowCollectionIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_DATE'
    | 'INVALID_ARRAY'
    | 'DUPLICATE_ID'
    | 'NON_CANONICAL_ORDER'
    | 'SPLIT_VIOLATION'
    | 'COUNT_MISMATCH'
    | 'DATE_POLICY_VIOLATION'
    | 'CLASS_DEGENERATE'
    | 'VECTOR_INVALID'
    | 'TARGET_ENCODING_MISMATCH'
    | 'ODDS_CONTAMINATION'
    | 'PROHIBITED_CONCEPT';
  path: string;
  message: string;
}>;

export type MLBFoldMaterialization = Readonly<{
  foldId: string;
  innerTrainRows: readonly MLBOuterTrainRow[];
  innerValidationRows: readonly MLBOuterTrainRow[];
  trainRowCount: number;
  validationRowCount: number;
  trainHomeWinCount: number;
  trainAwayWinCount: number;
  validationHomeWinCount: number;
  validationAwayWinCount: number;
  innerTrainDateRange: { startDate: string; endDate: string };
  innerValidationDateRange: { startDate: string; endDate: string };
  dateRangeProof: string;
}>;

export type MLBTrainOnlyInnerValidationFolds = Readonly<{
  contractVersion: typeof MLB_TRAIN_ONLY_INNER_VALIDATION_FOLDS_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  matrixId: string;
  manifestId: string;
  datasetId: string;
  foldPlanId: string;
  folds: readonly MLBFoldMaterialization[];
}>;

export type MLBTrainOnlyInnerValidationFoldsIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_DATE'
    | 'INVALID_ARRAY'
    | 'DUPLICATE_ID'
    | 'NON_CANONICAL_ORDER'
    | 'FOLD_COUNT_MISMATCH'
    | 'DATE_ORDER_VIOLATION'
    | 'DATE_OVERLAP'
    | 'COUNT_MISMATCH'
    | 'CLASS_DEGENERATE'
    | 'PROHIBITED_CONCEPT';
  path: string;
  message: string;
}>;

export type MLBInnerCandidatePredictionRecord = Readonly<{
  candidateRecipeId: string;
  foldId: string;
  exampleId: string;
  homeWinProbability: number;
}>;

export type MLBInnerDevelopmentReferenceFacts = Readonly<{
  contractVersion: 'mlb-inner-development-reference-facts-v1';
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  foldId: string;
  matrixId: string;
  manifestId: string;
  datasetId: string;
  innerTrainRowCount: number;
  innerValidationRowCount: number;
  innerTrainHomeWinCount: number;
  innerTrainAwayWinCount: number;
  innerTrainHomeWinPrior: number;
  p50: Readonly<{
    probability: number;
    logLoss: number;
    brierScore: number;
    rocAuc: number;
  }>;
  foldTrainPrior: Readonly<{
    probability: number;
    logLoss: number;
    brierScore: number;
    rocAuc: number;
  }>;
}>;

type MLBInnerDevelopmentReferenceProvenance = Readonly<{
  matrixId: string;
  manifestId: string;
  datasetId: string;
}>;

export type MLBInnerFoldOptimizerDiagnostics = Readonly<{
  converged: boolean;
  iterationsCompleted: number;
  finalTrainingObjective: number;
}>;

export type MLBInnerFoldMetricResult = Readonly<{
  contractVersion: 'mlb-inner-fold-metric-result-v1';
  foldId: string;
  candidateRecipeId: string;
  rowCount: number;
  targetHomeWinCount: number;
  targetAwayWinCount: number;
  candidateLogLoss: number;
  candidateBrierScore: number;
  candidateRocAuc: number;
  p50LogLoss: number;
  p50BrierScore: number;
  p50RocAuc: number;
  foldTrainPriorLogLoss: number;
  foldTrainPriorBrierScore: number;
  foldTrainPriorRocAuc: number;
  foldTrainPriorProbability: number;
  optimizerDiagnostics?: MLBInnerFoldOptimizerDiagnostics;
}>;

export type MLBInnerFoldMetricResultIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'PREDICTION_COUNT_MISMATCH'
    | 'EXAMPLE_ID_MISMATCH'
    | 'DUPLICATE_EXAMPLE_ID'
    | 'FOREIGN_EXAMPLE_ID'
    | 'MISSING_EXAMPLE_ID'
    | 'NONFINITE_PROBABILITY'
    | 'OUT_OF_RANGE_PROBABILITY'
    | 'TARGET_ENCODING_MISMATCH'
    | 'NONFINITE_METRIC'
    | 'ODDS_CONTAMINATION'
    | 'PROHIBITED_CONCEPT'
    | 'EMPTY_INNER_TRAIN'
    | 'EMPTY_INNER_VALIDATION'
    | 'INVALID_TARGET_VALUE'
    | 'NON_TRAIN_SPLIT'
    | 'ROW_COUNT_MISMATCH'
    | 'TRAIN_COUNT_MISMATCH'
    | 'PRIOR_MISMATCH'
    | 'P50_PROBABILITY_MISMATCH'
    | 'PROVENANCE_MISMATCH'
    | 'MIXED_CANDIDATE_RECIPE_ID'
    | 'MIXED_FOLD_ID'
    | 'CLASS_DEGENERATE'
    | 'INVALID_BOOLEAN';
  path: string;
  message: string;
}>;

export type MLBInnerAggregateResult = Readonly<{
  contractVersion: 'mlb-inner-aggregate-result-v1';
  candidateRecipeId: string;
  foldCount: number;
  aggregateValidationRowCount: number;
  aggregateCandidateLogLoss: number;
  aggregateCandidateBrierScore: number;
  aggregateCandidateRocAuc: number;
  aggregateP50LogLoss: number;
  aggregateP50BrierScore: number;
  aggregateP50RocAuc: number;
  aggregateFoldTrainPriorLogLoss: number;
  aggregateFoldTrainPriorBrierScore: number;
  aggregateFoldTrainPriorRocAuc: number;
  worstFoldCandidateLogLoss: number;
  worstFoldCandidateBrierScore: number;
  foldsBeatingP50OnLogLoss: number;
  foldsBeatingP50OnBrier: number;
  foldsBeatingFoldTrainPriorOnLogLoss: number;
  foldsBeatingFoldTrainPriorOnBrier: number;
}>;

export type MLBInnerAggregateResultIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'NONFINITE_METRIC'
    | 'INVALID_FOLD_SET'
    | 'MISSING_FOLD'
    | 'DUPLICATE_FOLD'
    | 'FOREIGN_FOLD'
    | 'ROW_COUNT_MISMATCH'
    | 'CLASS_COUNT_MISMATCH'
    | 'TRAIN_PRIOR_MISMATCH'
    | 'IDENTITY_MISMATCH'
    | 'P50_REFERENCE_MISMATCH'
    | 'PROHIBITED_CONCEPT';
  path: string;
  message: string;
}>;

export type MLBInnerCandidateGateResult = Readonly<{
  eligibility: 'INNER_ELIGIBLE' | 'INNER_REJECTED';
  reasons: readonly string[];
}>;

export type MLBInnerCandidateGateResultIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'NONFINITE_METRIC'
    | 'P50_REFERENCE_MISMATCH'
    | 'TRAIN_PRIOR_MISMATCH'
    | 'PROHIBITED_CONCEPT'
    | 'INVALID_FOLD_RESULT';
  path: string;
  message: string;
}>;

export type MLBInnerCandidateRecipe = Readonly<{
  candidateRecipeId: string;
  preprocessingPolicyId: string;
  featurePolicyId: string;
  modelFamilyId: string;
  regularizationConfig: unknown;
  optimizerConfig: unknown;
  otherModelAffectingChoices: unknown;
  complexityRank: number;
}>;

export type MLBInnerCandidateRecipeFingerprintIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_INTEGER'
    | 'INVALID_NUMBER'
    | 'INVALID_ARRAY'
    | 'NONFINITE_NUMBER'
    | 'CYCLIC_STRUCTURE'
    | 'INVALID_RECIPE_ID'
    | 'EMPTY_POLICY_ID'
    | 'INVALID_COMPLEXITY_RANK';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentRecipeBudget = Readonly<{
  contractVersion: 'mlb-inner-development-recipe-budget-v1';
  cycleId: typeof MLB_INNER_DEVELOPMENT_CYCLE_ID;
  maxDistinctRecipes: 12;
  seenRecipeIds: readonly string[];
  seenRecipeFingerprints: readonly string[];
  seenComplexityRanks: readonly number[];
  evaluationCount: number;
}>;

export type MLBInnerDevelopmentRecipeBudgetIssue = Readonly<{
  code:
    | 'MISSING_FIELD'
    | 'UNKNOWN_FIELD'
    | 'NOT_PLAIN_OBJECT'
    | 'INVALID_JSON_VALUE'
    | 'INVALID_STRING'
    | 'INVALID_LITERAL'
    | 'INVALID_NUMBER'
    | 'INVALID_INTEGER'
    | 'INVALID_ARRAY'
    | 'BUDGET_EXHAUSTED'
    | 'IDENTITY_ALIAS_CONFLICT'
    | 'IDENTITY_MUTATION_CONFLICT'
    | 'COMPLEXITY_RANK_MISMATCH';
  path: string;
  message: string;
}>;

export type MLBInnerRankableCandidateInput = Readonly<{
  recipe: MLBInnerCandidateRecipe;
  foldResults: readonly MLBInnerFoldMetricResult[];
}>;

export type MLBInnerCandidateRank = Readonly<{
  rank: number;
  candidateRecipeId: string;
  recipeFingerprint: string;
  aggregateLogLoss: number;
  aggregateBrierScore: number;
  complexityRank: number;
}>;

export type MLBInnerCandidateRankIssue = Readonly<{
  code:
    | 'INVALID_BUDGET'
    | 'INVALID_RECIPE'
    | 'UNREGISTERED_RECIPE'
    | 'RECIPE_FINGERPRINT_MISMATCH'
    | 'COMPLEXITY_RANK_MISMATCH'
    | 'RECIPE_FOLD_ID_MISMATCH'
    | 'INVALID_FOLD_RESULTS'
    | 'DUPLICATE_CANDIDATE_ENTRY';
  path: string;
  message: string;
}>;

export type MLBInnerCandidateRankResult =
  | Readonly<{ ok: true; value: readonly MLBInnerCandidateRank[] }>
  | Readonly<{ ok: false; issues: readonly MLBInnerCandidateRankIssue[] }>;

type EvaluatorIssue =
  | MLBTrainOnlyInnerRowCollectionIssue
  | MLBTrainOnlyInnerValidationFoldsIssue
  | MLBInnerFoldMetricResultIssue
  | MLBInnerAggregateResultIssue
  | MLBInnerCandidateGateResultIssue
  | MLBInnerCandidateRecipeFingerprintIssue
  | MLBInnerDevelopmentRecipeBudgetIssue
  | MLBInnerCandidateRankIssue;

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;
const PROHIBITED_ROW_FIELDS = new Set(['odds', 'sportsbook', 'moneyline']);

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
  issues: EvaluatorIssue[],
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
  issues: EvaluatorIssue[],
  code: EvaluatorIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message } as EvaluatorIssue);
  }
}

function sortIssues(issues: EvaluatorIssue[]): EvaluatorIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) return pathDiff;
      const codeDiff = a.code < b.code ? -1 : a.code === b.code ? 0 : 1;
      return codeDiff;
    })
    .filter(
      (item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
    );
}

function addKnownFieldIssues(
  record: Record<string, unknown>,
  known: Set<string>,
  path: string,
  issues: EvaluatorIssue[],
): void {
  const names = Object.getOwnPropertyNames(record);
  for (const key of names) {
    if (!known.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`);
    }
  }
}

function validateGregorianDate(value: unknown): boolean {
  if (typeof value !== 'string') {
    return false;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) {
    return false;
  }
  const maxDay = new Date(year, month, 0).getDate();
  return day >= 1 && day <= maxDay;
}

function dateFrom(iso: string): Date {
  return new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function validatePositiveInteger(
  value: unknown,
  path: string,
  label: string,
  issues: EvaluatorIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    pushIssue(
      issues,
      'INVALID_INTEGER',
      path,
      `${label} must be a positive safe integer`,
    );
    return undefined;
  }
  return value;
}

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
  issues: EvaluatorIssue[],
): string | undefined {
  if (!isStrictNonEmptyTrimmedString(value)) {
    pushIssue(
      issues,
      'INVALID_STRING',
      path,
      `${label} must be a valid identifier`,
    );
    return undefined;
  }
  return value;
}

const FROZEN_TRAIN_START_DATE = '2026-04-01';
const FROZEN_TRAIN_END_DATE = '2026-04-23';
const FROZEN_EXPECTED_OUTER_TRAIN_ROWS = 301;

export function validateMLBTrainOnlyInnerRowCollection(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBTrainOnlyInnerRowCollection }>
  | Readonly<{ ok: false; issues: readonly MLBTrainOnlyInnerRowCollectionIssue[] }> {
  const issues: EvaluatorIssue[] = [];

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushIssue(
              issues,
              'ODDS_CONTAMINATION',
              `$${firewallPath.replace(/^\./, '')}`,
              `Row collection contains prohibited field at ${firewallPath}`,
            );
          }
        }
      } else if (
        error.name === 'UninspectableAccessorPropertyError' &&
        error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
      ) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushIssue(
              issues,
              'INVALID_JSON_VALUE',
              `$${accessorPath.replace(/^\./, '')}`,
              'Row collection contains an accessor property',
            );
          }
        }
      }
    }
  }

  if (!isPlainObject(value)) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBTrainOnlyInnerRowCollectionIssue[] };
  }

  const root = value as Record<string, unknown>;

  const knownRootFields = new Set([
    'contractVersion',
    'sport',
    'target',
    'targetEncoding',
    'matrixId',
    'manifestId',
    'datasetId',
    'rowCount',
    'homeWinCount',
    'awayWinCount',
    'rows',
  ]);
  addKnownFieldIssues(root, knownRootFields, '$', issues);

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION}`,
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
  } else if (targetEncodingResult.kind === 'data') {
    if (targetEncodingResult.value !== 'HOME_WIN_1_AWAY_WIN_0') {
      pushIssue(issues, 'INVALID_LITERAL', '$.targetEncoding', 'targetEncoding must be HOME_WIN_1_AWAY_WIN_0');
    }
  }

  const matrixIdResult = ownDataProperty(root, 'matrixId', '$.matrixId', issues);
  if (matrixIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.matrixId', 'matrixId is required');
  } else if (matrixIdResult.kind === 'data') {
    const id = validateIdentifier(matrixIdResult.value, '$.matrixId', 'matrixId', issues);
    if (typeof id !== 'string') {
      // issue already pushed
    }
  }

  const manifestIdResult = ownDataProperty(root, 'manifestId', '$.manifestId', issues);
  if (manifestIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.manifestId', 'manifestId is required');
  } else if (manifestIdResult.kind === 'data') {
    const id = validateIdentifier(manifestIdResult.value, '$.manifestId', 'manifestId', issues);
    if (typeof id !== 'string') {
      // issue already pushed
    }
  }

  const datasetIdResult = ownDataProperty(root, 'datasetId', '$.datasetId', issues);
  if (datasetIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetId', 'datasetId is required');
  } else if (datasetIdResult.kind === 'data') {
    const id = validateIdentifier(datasetIdResult.value, '$.datasetId', 'datasetId', issues);
    if (typeof id !== 'string') {
      // issue already pushed
    }
  }

  const rowCountResult = ownDataProperty(root, 'rowCount', '$.rowCount', issues);
  let rowCount: number | undefined;
  if (rowCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.rowCount', 'rowCount is required');
  } else if (rowCountResult.kind === 'data') {
    rowCount = validatePositiveInteger(rowCountResult.value, '$.rowCount', 'rowCount', issues);
  }

  const homeWinCountResult = ownDataProperty(root, 'homeWinCount', '$.homeWinCount', issues);
  let homeWinCount: number | undefined;
  if (homeWinCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.homeWinCount', 'homeWinCount is required');
  } else if (homeWinCountResult.kind === 'data') {
    homeWinCount = validatePositiveInteger(homeWinCountResult.value, '$.homeWinCount', 'homeWinCount', issues);
  }

  const awayWinCountResult = ownDataProperty(root, 'awayWinCount', '$.awayWinCount', issues);
  let awayWinCount: number | undefined;
  if (awayWinCountResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.awayWinCount', 'awayWinCount is required');
  } else if (awayWinCountResult.kind === 'data') {
    awayWinCount = validatePositiveInteger(awayWinCountResult.value, '$.awayWinCount', 'awayWinCount', issues);
  }

  if (rowCount !== undefined && homeWinCount !== undefined && awayWinCount !== undefined) {
    if (homeWinCount + awayWinCount !== rowCount) {
      pushIssue(
        issues,
        'COUNT_MISMATCH',
        '$.rowCount',
        'homeWinCount + awayWinCount must equal rowCount',
      );
    }
  }

  const rowsResult = ownDataProperty(root, 'rows', '$.rows', issues);
  let rows: unknown[] = [];
  if (rowsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.rows', 'rows is required');
  } else if (rowsResult.kind === 'accessor') {
    // already reported
  } else {
    const arrayResult = readDescriptorSafeArray(rowsResult.value, '$.rows', issues);
    if (arrayResult === null) {
      // issues already pushed
    } else {
      rows = arrayResult;
      if (rows.length === 0) {
        pushIssue(issues, 'INVALID_ARRAY', '$.rows', 'rows must not be empty');
      }
    }
  }

  const seenExampleIds = new Set<string>();
  let actualTrain = 0;
  let actualHome = 0;
  let actualAway = 0;
  let previousRow: MLBOuterTrainRow | undefined;
  const validatedRows: MLBOuterTrainRow[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rowPath = `$.rows[${i}]`;
    const row = rows[i];

    if (!isPlainObject(row)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', rowPath, 'Row must be a plain object');
      continue;
    }

    const rowRoot = row as Record<string, unknown>;
    addKnownFieldIssues(rowRoot, new Set(['exampleId', 'split', 'vector', 'targetValue']), rowPath, issues);

    for (const key of Object.getOwnPropertyNames(rowRoot)) {
      if (PROHIBITED_ROW_FIELDS.has(key)) {
        const descriptor = Object.getOwnPropertyDescriptor(rowRoot, key);
        if (descriptor && isDataDescriptor(descriptor)) {
          pushIssue(issues, 'PROHIBITED_CONCEPT', `${rowPath}.${key}`, `Prohibited field: ${key}`);
        } else if (descriptor) {
          pushIssue(issues, 'INVALID_JSON_VALUE', `${rowPath}.${key}`, 'Prohibited accessor');
        }
      }
    }

    const exampleIdResult = ownDataProperty(rowRoot, 'exampleId', `${rowPath}.exampleId`, issues);
    let exampleId: string | undefined;
    if (exampleIdResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `${rowPath}.exampleId`, 'exampleId is required');
    } else if (exampleIdResult.kind === 'data') {
      exampleId = validateIdentifier(exampleIdResult.value, `${rowPath}.exampleId`, 'exampleId', issues);
      if (typeof exampleId === 'string') {
        if (seenExampleIds.has(exampleId)) {
          pushIssue(issues, 'DUPLICATE_ID', `${rowPath}.exampleId`, `Duplicate exampleId: ${exampleId}`);
        } else {
          seenExampleIds.add(exampleId);
        }
      }
    }

    const splitResult = ownDataProperty(rowRoot, 'split', `${rowPath}.split`, issues);
    let split: 'TRAIN' | 'VALIDATION' | 'TEST' | undefined;
    if (splitResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `${rowPath}.split`, 'split is required');
    } else if (splitResult.kind === 'data') {
      if (splitResult.value !== 'TRAIN' && splitResult.value !== 'VALIDATION' && splitResult.value !== 'TEST') {
        pushIssue(issues, 'INVALID_LITERAL', `${rowPath}.split`, 'split must be TRAIN, VALIDATION, or TEST');
      } else {
        split = splitResult.value;
      }
    }

    const vectorRawResult = ownDataProperty(rowRoot, 'vector', `${rowPath}.vector`, issues);
    let validatedVector: MLBFeatureVector | undefined;
    if (vectorRawResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `${rowPath}.vector`, 'vector is required');
    } else if (vectorRawResult.kind === 'accessor') {
      // already reported
    } else {
      const vectorRoot = vectorRawResult.value as Record<string, unknown> | null;
      if (vectorRoot && isPlainObject(vectorRoot)) {
        const rawOfficialDateResult = ownDataProperty(vectorRoot, 'officialDate', `${rowPath}.vector.officialDate`, issues);
        if (rawOfficialDateResult.kind === 'data' && !validateGregorianDate(rawOfficialDateResult.value)) {
          pushIssue(issues, 'INVALID_DATE', `${rowPath}.vector.officialDate`, `Invalid officialDate: ${rawOfficialDateResult.value}`);
        }
      }

      const vectorValidateResult = validateMLBFeatureVector(vectorRawResult.value);
      if (!vectorValidateResult.ok) {
        pushIssue(issues, 'VECTOR_INVALID', `${rowPath}.vector`, `Vector invalid: ${vectorValidateResult.issues[0]?.code ?? 'unknown'} at ${vectorValidateResult.issues[0]?.path ?? '$'}`);
      } else {
        validatedVector = vectorValidateResult.value;
      }
    }

    const targetValueResult = ownDataProperty(rowRoot, 'targetValue', `${rowPath}.targetValue`, issues);
    let targetValue: 0 | 1 | undefined;
    if (targetValueResult.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `${rowPath}.targetValue`, 'targetValue is required');
    } else if (targetValueResult.kind === 'data') {
      if (targetValueResult.value === 0) {
        targetValue = 0;
      } else if (targetValueResult.value === 1) {
        targetValue = 1;
      } else {
        pushIssue(issues, 'TARGET_ENCODING_MISMATCH', `${rowPath}.targetValue`, 'targetValue must be 0 or 1');
      }
    }

    if (exampleId && split === 'TRAIN' && validatedVector && targetValue !== undefined) {
      actualTrain++;
      if (targetValue === 1) actualHome++;
      else actualAway++;

      const currentValidRow: MLBOuterTrainRow = {
        exampleId,
        split: 'TRAIN',
        vector: validatedVector,
        targetValue,
      };

      if (previousRow) {
        const dateDiff = compareStrings(currentValidRow.vector.officialDate, previousRow.vector.officialDate);
        if (dateDiff < 0) {
          pushIssue(issues, 'NON_CANONICAL_ORDER', '$.rows', 'Rows are not in canonical order');
        } else if (dateDiff === 0) {
          const gameIdDiff = compareStrings(currentValidRow.vector.gameId, previousRow.vector.gameId);
          if (gameIdDiff < 0) {
            pushIssue(issues, 'NON_CANONICAL_ORDER', '$.rows', 'Rows are not in canonical order');
          } else if (gameIdDiff === 0) {
            const snapshotIdDiff = compareStrings(currentValidRow.vector.snapshotId, previousRow.vector.snapshotId);
            if (snapshotIdDiff < 0) {
              pushIssue(issues, 'NON_CANONICAL_ORDER', '$.rows', 'Rows are not in canonical order');
            } else if (snapshotIdDiff === 0) {
              const exampleIdDiff = compareStrings(currentValidRow.exampleId, previousRow.exampleId);
              if (exampleIdDiff <= 0) {
                pushIssue(issues, 'NON_CANONICAL_ORDER', '$.rows', 'Rows are not in canonical order');
              }
            }
          }
        }
      }

      previousRow = currentValidRow;
      validatedRows.push(currentValidRow);
    } else if (split === 'VALIDATION' || split === 'TEST') {
      pushIssue(issues, 'SPLIT_VIOLATION', rowPath, 'Non-TRAIN row found in TRAIN-only collection');
    }
  }

  if (rowCount !== undefined && actualTrain !== rowCount) {
    pushIssue(
      issues,
      'COUNT_MISMATCH',
      '$.rowCount',
      `Expected ${rowCount} TRAIN rows, found ${actualTrain}`,
    );
  }

  if (homeWinCount !== undefined && actualHome !== homeWinCount) {
    pushIssue(
      issues,
      'COUNT_MISMATCH',
      '$.homeWinCount',
      `Expected ${homeWinCount} home wins, found ${actualHome}`,
    );
  }

  if (awayWinCount !== undefined && actualAway !== awayWinCount) {
    pushIssue(
      issues,
      'COUNT_MISMATCH',
      '$.awayWinCount',
      `Expected ${awayWinCount} away wins, found ${actualAway}`,
    );
  }

  if (actualHome === 0 || actualAway === 0) {
    pushIssue(issues, 'CLASS_DEGENERATE', '$.rows', 'Both home and away win classes must be present');
  }

  for (const row of validatedRows) {
    const officialDate = row.vector.officialDate;
    if (!validateGregorianDate(officialDate)) {
      pushIssue(issues, 'INVALID_DATE', `$.rows[].vector.officialDate`, `Invalid officialDate: ${officialDate}`);
    } else {
      const date = dateFrom(officialDate);
      const start = dateFrom(FROZEN_TRAIN_START_DATE);
      const end = dateFrom(FROZEN_TRAIN_END_DATE);
      if (date < start || date > end) {
        pushIssue(
          issues,
          'DATE_POLICY_VIOLATION',
          `$.rows[].vector.officialDate`,
          `TRAIN row officialDate ${officialDate} is outside frozen TRAIN window`,
        );
      }
    }
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues as readonly MLBTrainOnlyInnerRowCollectionIssue[] };
  }

  return {
    ok: true,
    value: {
      contractVersion: MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION,
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      matrixId: root.matrixId as string,
      manifestId: root.manifestId as string,
      datasetId: root.datasetId as string,
      rowCount: actualTrain,
      homeWinCount: actualHome,
      awayWinCount: actualAway,
      rows: validatedRows,
    },
  };
}

export type MLBTrainOnlyInnerRowCollectionOrMatrixIssue =
  | MLBTrainingMatrixIssue
  | MLBTrainOnlyInnerRowCollectionIssue;

export function extractMLBOuterTrainRowsForInnerDevelopment(
  matrix: MLBTrainingMatrix,
):
  | Readonly<{ ok: true; value: MLBTrainOnlyInnerRowCollection }>
  | Readonly<{ ok: false; issues: readonly MLBTrainOnlyInnerRowCollectionOrMatrixIssue[] }> {
  const matrixResult = validateMLBTrainingMatrix(matrix);
  if (!matrixResult.ok) {
    return { ok: false, issues: matrixResult.issues as readonly MLBTrainOnlyInnerRowCollectionOrMatrixIssue[] };
  }

  const validatedMatrix = matrixResult.value;
  const sourceRows = validatedMatrix.rows;

  if (validatedMatrix.sport !== 'MLB') {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_LITERAL',
          path: '$.sport',
          message: 'sport must be MLB',
        } as MLBTrainingMatrixIssue,
      ],
    };
  }

  if (validatedMatrix.target !== 'OFFICIAL_FINAL_GAME_WINNER') {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_LITERAL',
          path: '$.target',
          message: 'target must be OFFICIAL_FINAL_GAME_WINNER',
        } as MLBTrainingMatrixIssue,
      ],
    };
  }

  const trainRows = sourceRows.filter((row) => row.split === 'TRAIN') as MLBOuterTrainRow[];

  if (trainRows.length !== FROZEN_EXPECTED_OUTER_TRAIN_ROWS) {
    return {
      ok: false,
      issues: [
        {
          code: 'SPLIT_COUNT_MISMATCH',
          path: '$.rows',
          message: `Expected exactly ${FROZEN_EXPECTED_OUTER_TRAIN_ROWS} TRAIN rows, found ${trainRows.length}`,
        } as MLBTrainingMatrixIssue,
      ],
    };
  }

  const seenExampleIds = new Set<string>();
  for (const row of trainRows) {
    if (seenExampleIds.has(row.exampleId)) {
      return {
        ok: false,
        issues: [
          {
            code: 'DUPLICATE_ID',
            path: '$.rows',
            message: `Duplicate exampleId: ${row.exampleId}`,
          } as MLBTrainingMatrixIssue,
        ],
      };
    }
    seenExampleIds.add(row.exampleId);
  }

  const collection = {
    contractVersion: MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0' as const,
    matrixId: validatedMatrix.matrixId,
    manifestId: validatedMatrix.manifestId,
    datasetId: validatedMatrix.datasetId,
    rowCount: trainRows.length,
    homeWinCount: trainRows.filter((r) => r.targetValue === 1).length,
    awayWinCount: trainRows.filter((r) => r.targetValue === 0).length,
    rows: trainRows,
  };

  const collectionValidation = validateMLBTrainOnlyInnerRowCollection(collection);
  if (!collectionValidation.ok) {
    return {
      ok: false,
      issues: collectionValidation.issues as readonly MLBTrainingMatrixIssue[],
    };
  }

  return { ok: true, value: collectionValidation.value };
}

export function validateMLBTrainOnlyInnerValidationFolds(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBTrainOnlyInnerValidationFolds }>
  | Readonly<{ ok: false; issues: readonly MLBTrainOnlyInnerValidationFoldsIssue[] }> {
  const issues: EvaluatorIssue[] = [];

  try {
    assertNoOddsContamination(value);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('ODDS_CONTAMINATION')) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const firewallPath = line.slice(5).split('; ')[0];
            pushIssue(
              issues,
              'ODDS_CONTAMINATION',
              `$${firewallPath.replace(/^\./, '')}`,
              `Fold result contains prohibited field at ${firewallPath}`,
            );
          }
        }
      } else if (
        error.name === 'UninspectableAccessorPropertyError' &&
        error.message.startsWith('UNINSPECTABLE_ACCESSOR_PROPERTY\n')
      ) {
        for (const line of error.message.split('\n')) {
          if (line.startsWith('path=')) {
            const accessorPath = line.slice(5);
            pushIssue(
              issues,
              'INVALID_JSON_VALUE',
              `$${accessorPath.replace(/^\./, '')}`,
              'Fold result contains an accessor property',
            );
          }
        }
      }
    }
  }

  if (!isPlainObject(value)) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBTrainOnlyInnerValidationFoldsIssue[] };
  }

  const root = value as Record<string, unknown>;

  const knownRootFields = new Set([
    'contractVersion',
    'sport',
    'target',
    'matrixId',
    'manifestId',
    'datasetId',
    'foldPlanId',
    'folds',
  ]);
  addKnownFieldIssues(root, knownRootFields, '$', issues);

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_TRAIN_ONLY_INNER_VALIDATION_FOLDS_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_TRAIN_ONLY_INNER_VALIDATION_FOLDS_CONTRACT_VERSION}`,
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

  const matrixIdResult = ownDataProperty(root, 'matrixId', '$.matrixId', issues);
  if (matrixIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.matrixId', 'matrixId is required');
  } else if (matrixIdResult.kind === 'data') {
    const id = validateIdentifier(matrixIdResult.value, '$.matrixId', 'matrixId', issues);
    if (typeof id !== 'string') {
      // issue already pushed
    }
  }

  const manifestIdResult = ownDataProperty(root, 'manifestId', '$.manifestId', issues);
  if (manifestIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.manifestId', 'manifestId is required');
  } else if (manifestIdResult.kind === 'data') {
    const id = validateIdentifier(manifestIdResult.value, '$.manifestId', 'manifestId', issues);
    if (typeof id !== 'string') {
      // issue already pushed
    }
  }

  const datasetIdResult = ownDataProperty(root, 'datasetId', '$.datasetId', issues);
  if (datasetIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.datasetId', 'datasetId is required');
  } else if (datasetIdResult.kind === 'data') {
    const id = validateIdentifier(datasetIdResult.value, '$.datasetId', 'datasetId', issues);
    if (typeof id !== 'string') {
      // issue already pushed
    }
  }

  const foldPlanIdResult = ownDataProperty(root, 'foldPlanId', '$.foldPlanId', issues);
  if (foldPlanIdResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.foldPlanId', 'foldPlanId is required');
  } else if (foldPlanIdResult.kind === 'data') {
    const id = validateIdentifier(foldPlanIdResult.value, '$.foldPlanId', 'foldPlanId', issues);
    if (typeof id !== 'string') {
      // issue already pushed
    }
  }

  const foldsResult = ownDataProperty(root, 'folds', '$.folds', issues);
  if (foldsResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.folds', 'folds is required');
  } else if (foldsResult.kind === 'accessor') {
    // already reported
  } else {
    const arrayResult = readDescriptorSafeArray(foldsResult.value, '$.folds', issues);
    if (arrayResult === null) {
      // issues already pushed
    } else {
      const validatedFolds = arrayResult as unknown[];
      if (validatedFolds.length !== 4) {
        pushIssue(
          issues,
          'FOLD_COUNT_MISMATCH',
          '$.folds',
          `Expected exactly 4 folds, found ${validatedFolds.length}`,
        );
      }

      const canonicalFolds = MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN.folds;
      const seenFoldIds = new Set<string>();

      for (let i = 0; i < validatedFolds.length; i++) {
        const foldPath = `$.folds[${i}]`;
        const fold = validatedFolds[i];

        if (!isPlainObject(fold)) {
          pushIssue(issues, 'NOT_PLAIN_OBJECT', foldPath, 'Fold must be a plain object');
          continue;
        }

        const foldRoot = fold as Record<string, unknown>;
        addKnownFieldIssues(
          foldRoot,
          new Set([
            'foldId',
            'innerTrainRows',
            'innerValidationRows',
            'trainRowCount',
            'validationRowCount',
            'trainHomeWinCount',
            'trainAwayWinCount',
            'validationHomeWinCount',
            'validationAwayWinCount',
            'innerTrainDateRange',
            'innerValidationDateRange',
            'dateRangeProof',
          ]),
          foldPath,
          issues,
        );

        const foldIdResult = ownDataProperty(foldRoot, 'foldId', `${foldPath}.foldId`, issues);
        let foldId: string | undefined;
        if (foldIdResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.foldId`, 'foldId is required');
        } else if (foldIdResult.kind === 'data') {
          foldId = validateIdentifier(foldIdResult.value, `${foldPath}.foldId`, 'foldId', issues);
          if (typeof foldId === 'string') {
            if (seenFoldIds.has(foldId)) {
              pushIssue(issues, 'DUPLICATE_ID', `${foldPath}.foldId`, `Duplicate foldId: ${foldId}`);
            } else {
              seenFoldIds.add(foldId);
            }
          }
        }

        const expectedFold = canonicalFolds[i];
        if (foldId && expectedFold && foldId !== expectedFold.foldId) {
          pushIssue(
            issues,
            'NON_CANONICAL_ORDER',
            `${foldPath}.foldId`,
            `Fold order mismatch: expected ${expectedFold.foldId} at index ${i}`,
          );
        }

        const innerTrainRowsResult = ownDataProperty(foldRoot, 'innerTrainRows', `${foldPath}.innerTrainRows`, issues);
        if (innerTrainRowsResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.innerTrainRows`, 'innerTrainRows is required');
        } else if (innerTrainRowsResult.kind === 'data') {
          if (!Array.isArray(innerTrainRowsResult.value)) {
            pushIssue(issues, 'INVALID_ARRAY', `${foldPath}.innerTrainRows`, 'innerTrainRows must be an array');
          }
        }

        const innerValidationRowsResult = ownDataProperty(foldRoot, 'innerValidationRows', `${foldPath}.innerValidationRows`, issues);
        if (innerValidationRowsResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.innerValidationRows`, 'innerValidationRows is required');
        } else if (innerValidationRowsResult.kind === 'data') {
          if (!Array.isArray(innerValidationRowsResult.value)) {
            pushIssue(issues, 'INVALID_ARRAY', `${foldPath}.innerValidationRows`, 'innerValidationRows must be an array');
          }
        }

        const trainRowCountResult = ownDataProperty(foldRoot, 'trainRowCount', `${foldPath}.trainRowCount`, issues);
        let trainRowCount: number | undefined;
        if (trainRowCountResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.trainRowCount`, 'trainRowCount is required');
        } else if (trainRowCountResult.kind === 'data') {
          trainRowCount = validatePositiveInteger(trainRowCountResult.value, `${foldPath}.trainRowCount`, 'trainRowCount', issues);
        }

        const validationRowCountResult = ownDataProperty(foldRoot, 'validationRowCount', `${foldPath}.validationRowCount`, issues);
        let validationRowCount: number | undefined;
        if (validationRowCountResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.validationRowCount`, 'validationRowCount is required');
        } else if (validationRowCountResult.kind === 'data') {
          validationRowCount = validatePositiveInteger(validationRowCountResult.value, `${foldPath}.validationRowCount`, 'validationRowCount', issues);
        }

        const trainHomeWinCountResult = ownDataProperty(foldRoot, 'trainHomeWinCount', `${foldPath}.trainHomeWinCount`, issues);
        let trainHomeWinCount: number | undefined;
        if (trainHomeWinCountResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.trainHomeWinCount`, 'trainHomeWinCount is required');
        } else if (trainHomeWinCountResult.kind === 'data') {
          trainHomeWinCount = validatePositiveInteger(trainHomeWinCountResult.value, `${foldPath}.trainHomeWinCount`, 'trainHomeWinCount', issues);
        }

        const trainAwayWinCountResult = ownDataProperty(foldRoot, 'trainAwayWinCount', `${foldPath}.trainAwayWinCount`, issues);
        let trainAwayWinCount: number | undefined;
        if (trainAwayWinCountResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.trainAwayWinCount`, 'trainAwayWinCount is required');
        } else if (trainAwayWinCountResult.kind === 'data') {
          trainAwayWinCount = validatePositiveInteger(trainAwayWinCountResult.value, `${foldPath}.trainAwayWinCount`, 'trainAwayWinCount', issues);
        }

        const validationHomeWinCountResult = ownDataProperty(foldRoot, 'validationHomeWinCount', `${foldPath}.validationHomeWinCount`, issues);
        let validationHomeWinCount: number | undefined;
        if (validationHomeWinCountResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.validationHomeWinCount`, 'validationHomeWinCount is required');
        } else if (validationHomeWinCountResult.kind === 'data') {
          validationHomeWinCount = validatePositiveInteger(validationHomeWinCountResult.value, `${foldPath}.validationHomeWinCount`, 'validationHomeWinCount', issues);
        }

        const validationAwayWinCountResult = ownDataProperty(foldRoot, 'validationAwayWinCount', `${foldPath}.validationAwayWinCount`, issues);
        let validationAwayWinCount: number | undefined;
        if (validationAwayWinCountResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.validationAwayWinCount`, 'validationAwayWinCount is required');
        } else if (validationAwayWinCountResult.kind === 'data') {
          validationAwayWinCount = validatePositiveInteger(validationAwayWinCountResult.value, `${foldPath}.validationAwayWinCount`, 'validationAwayWinCount', issues);
        }

        if (
          innerTrainRowsResult.kind === 'data' &&
          Array.isArray(innerTrainRowsResult.value) &&
          trainRowCount !== undefined &&
          innerTrainRowsResult.value.length !== trainRowCount
        ) {
          pushIssue(
            issues,
            'COUNT_MISMATCH',
            `${foldPath}.trainRowCount`,
            `innerTrainRows length ${innerTrainRowsResult.value.length} does not match trainRowCount ${trainRowCount}`,
          );
        }

        if (
          innerValidationRowsResult.kind === 'data' &&
          Array.isArray(innerValidationRowsResult.value) &&
          validationRowCount !== undefined &&
          innerValidationRowsResult.value.length !== validationRowCount
        ) {
          pushIssue(
            issues,
            'COUNT_MISMATCH',
            `${foldPath}.validationRowCount`,
            `innerValidationRows length ${innerValidationRowsResult.value.length} does not match validationRowCount ${validationRowCount}`,
          );
        }

        const innerTrainDateRangeResult = ownDataProperty(foldRoot, 'innerTrainDateRange', `${foldPath}.innerTrainDateRange`, issues);
        if (innerTrainDateRangeResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.innerTrainDateRange`, 'innerTrainDateRange is required');
        } else if (innerTrainDateRangeResult.kind === 'data') {
          if (!isPlainObject(innerTrainDateRangeResult.value)) {
            pushIssue(issues, 'NOT_PLAIN_OBJECT', `${foldPath}.innerTrainDateRange`, 'innerTrainDateRange must be a plain object');
          } else {
            const range = innerTrainDateRangeResult.value as Record<string, unknown>;
            const startResult = ownDataProperty(range, 'startDate', `${foldPath}.innerTrainDateRange.startDate`, issues);
            const endResult = ownDataProperty(range, 'endDate', `${foldPath}.innerTrainDateRange.endDate`, issues);
            if (startResult.kind === 'data' && !validateGregorianDate(startResult.value)) {
              pushIssue(issues, 'INVALID_DATE', `${foldPath}.innerTrainDateRange.startDate`, 'Invalid startDate');
            }
            if (endResult.kind === 'data' && !validateGregorianDate(endResult.value)) {
              pushIssue(issues, 'INVALID_DATE', `${foldPath}.innerTrainDateRange.endDate`, 'Invalid endDate');
            }
          }
        }

        const innerValidationDateRangeResult = ownDataProperty(foldRoot, 'innerValidationDateRange', `${foldPath}.innerValidationDateRange`, issues);
        if (innerValidationDateRangeResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.innerValidationDateRange`, 'innerValidationDateRange is required');
        } else if (innerValidationDateRangeResult.kind === 'data') {
          if (!isPlainObject(innerValidationDateRangeResult.value)) {
            pushIssue(issues, 'NOT_PLAIN_OBJECT', `${foldPath}.innerValidationDateRange`, 'innerValidationDateRange must be a plain object');
          } else {
            const range = innerValidationDateRangeResult.value as Record<string, unknown>;
            const startResult = ownDataProperty(range, 'startDate', `${foldPath}.innerValidationDateRange.startDate`, issues);
            const endResult = ownDataProperty(range, 'endDate', `${foldPath}.innerValidationDateRange.endDate`, issues);
            if (startResult.kind === 'data' && !validateGregorianDate(startResult.value)) {
              pushIssue(issues, 'INVALID_DATE', `${foldPath}.innerValidationDateRange.startDate`, 'Invalid startDate');
            }
            if (endResult.kind === 'data' && !validateGregorianDate(endResult.value)) {
              pushIssue(issues, 'INVALID_DATE', `${foldPath}.innerValidationDateRange.endDate`, 'Invalid endDate');
            }
          }
        }

        const dateRangeProofResult = ownDataProperty(foldRoot, 'dateRangeProof', `${foldPath}.dateRangeProof`, issues);
        if (dateRangeProofResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.dateRangeProof`, 'dateRangeProof is required');
        } else if (dateRangeProofResult.kind === 'data') {
          if (!isStrictNonEmptyTrimmedString(dateRangeProofResult.value)) {
            pushIssue(issues, 'INVALID_STRING', `${foldPath}.dateRangeProof`, 'dateRangeProof must be a non-empty string');
          }
        }

        if (
          trainRowCount !== undefined &&
          validationRowCount !== undefined &&
          trainHomeWinCount !== undefined &&
          trainAwayWinCount !== undefined &&
          validationHomeWinCount !== undefined &&
          validationAwayWinCount !== undefined
        ) {
          if (trainHomeWinCount + trainAwayWinCount !== trainRowCount) {
            pushIssue(
              issues,
              'COUNT_MISMATCH',
              `${foldPath}.trainRowCount`,
              'trainHomeWinCount + trainAwayWinCount must equal trainRowCount',
            );
          }
          if (validationHomeWinCount + validationAwayWinCount !== validationRowCount) {
            pushIssue(
              issues,
              'COUNT_MISMATCH',
              `${foldPath}.validationRowCount`,
              'validationHomeWinCount + validationAwayWinCount must equal validationRowCount',
            );
          }
          if (trainHomeWinCount === 0 || trainAwayWinCount === 0) {
            pushIssue(
              issues,
              'CLASS_DEGENERATE',
              `${foldPath}.trainRowCount`,
              'Both home and away win classes must be present in train',
            );
          }
          if (validationHomeWinCount === 0 || validationAwayWinCount === 0) {
            pushIssue(
              issues,
              'CLASS_DEGENERATE',
              `${foldPath}.validationRowCount`,
              'Both home and away win classes must be present in validation',
            );
          }
        }
      }
    }
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues as readonly MLBTrainOnlyInnerValidationFoldsIssue[] };
  }

  return { ok: true, value: value as MLBTrainOnlyInnerValidationFolds };
}

function readDescriptorSafeArray(
  value: unknown,
  path: string,
  issues: EvaluatorIssue[],
): unknown[] | null {
  if (!Array.isArray(value)) {
    pushIssue(issues, 'INVALID_ARRAY', path, `${path} must be an array`);
    return null;
  }
  return value;
}

export function buildMLBTrainOnlyInnerValidationFolds(
  trainRows: MLBTrainOnlyInnerRowCollection,
  foldPlan: MLBTrainOnlyInnerFoldPlan,
): MLBTrainOnlyInnerValidationFolds {
  const planValidation = validateMLBTrainOnlyInnerFoldPlan(foldPlan);
  if (!planValidation.ok) {
    throw new Error(`Invalid fold plan: ${planValidation.issues.map((i) => `${i.code}: ${i.message}`).join(', ')}`);
  }

  const validatedPlan = planValidation.value;
  const folds: MLBFoldMaterialization[] = [];

  const allTrainExampleIds = new Set(trainRows.rows.map((r) => r.exampleId));
  const allValidationExampleIds = new Set<string>();
  const allTrainDates = new Set<string>();
  const allValidationDates = new Set<string>();

  for (const foldDef of validatedPlan.folds) {
    const trainStart = dateFrom(foldDef.innerTrainStartDate);
    const trainEnd = dateFrom(foldDef.innerTrainEndDate);
    const validationStart = dateFrom(foldDef.innerValidationStartDate);
    const validationEnd = dateFrom(foldDef.innerValidationEndDate);

    const innerTrainRows = trainRows.rows.filter((row) => {
      const rowDate = dateFrom(row.vector.officialDate);
      return rowDate >= trainStart && rowDate <= trainEnd;
    });

    const innerValidationRows = trainRows.rows.filter((row) => {
      const rowDate = dateFrom(row.vector.officialDate);
      return rowDate >= validationStart && rowDate <= validationEnd;
    });

    const trainHomeWins = innerTrainRows.filter((r) => r.targetValue === 1).length;
    const trainAwayWins = innerTrainRows.filter((r) => r.targetValue === 0).length;
    const validationHomeWins = innerValidationRows.filter((r) => r.targetValue === 1).length;
    const validationAwayWins = innerValidationRows.filter((r) => r.targetValue === 0).length;

    if (innerTrainRows.length !== foldDef.expectedTrainRowCount) {
      throw new Error(
        `Fold ${foldDef.foldId} train row count mismatch: expected ${foldDef.expectedTrainRowCount}, got ${innerTrainRows.length}`,
      );
    }
    if (innerValidationRows.length !== foldDef.expectedValidationRowCount) {
      throw new Error(
        `Fold ${foldDef.foldId} validation row count mismatch: expected ${foldDef.expectedValidationRowCount}, got ${innerValidationRows.length}`,
      );
    }
    if (trainHomeWins !== foldDef.expectedTrainHomeWinCount) {
      throw new Error(
        `Fold ${foldDef.foldId} train home win count mismatch: expected ${foldDef.expectedTrainHomeWinCount}, got ${trainHomeWins}`,
      );
    }
    if (trainAwayWins !== foldDef.expectedTrainAwayWinCount) {
      throw new Error(
        `Fold ${foldDef.foldId} train away win count mismatch: expected ${foldDef.expectedTrainAwayWinCount}, got ${trainAwayWins}`,
      );
    }
    if (validationHomeWins !== foldDef.expectedValidationHomeWinCount) {
      throw new Error(
        `Fold ${foldDef.foldId} validation home win count mismatch: expected ${foldDef.expectedValidationHomeWinCount}, got ${validationHomeWins}`,
      );
    }
    if (validationAwayWins !== foldDef.expectedValidationAwayWinCount) {
      throw new Error(
        `Fold ${foldDef.foldId} validation away win count mismatch: expected ${foldDef.expectedValidationAwayWinCount}, got ${validationAwayWins}`,
      );
    }

    if (trainHomeWins === 0 || trainAwayWins === 0) {
      throw new Error(`Fold ${foldDef.foldId} train is class-degenerate`);
    }
    if (validationHomeWins === 0 || validationAwayWins === 0) {
      throw new Error(`Fold ${foldDef.foldId} validation is class-degenerate`);
    }

    const trainExampleIds = new Set(innerTrainRows.map((r) => r.exampleId));
    const validationExampleIds = new Set(innerValidationRows.map((r) => r.exampleId));
    const intersection = new Set([...trainExampleIds].filter((id) => validationExampleIds.has(id)));
    if (intersection.size > 0) {
      throw new Error(`Fold ${foldDef.foldId} has overlapping train/validation identities`);
    }

    const allTrainDatesInFold = new Set(innerTrainRows.map((r) => r.vector.officialDate));
    const allValidationDatesInFold = new Set(innerValidationRows.map((r) => r.vector.officialDate));
    const dateIntersection = new Set([...allTrainDatesInFold].filter((d) => allValidationDatesInFold.has(d)));
    if (dateIntersection.size > 0) {
      throw new Error(`Fold ${foldDef.foldId} has overlapping train/validation dates`);
    }

    const maxTrainDate = new Date(Math.max(...innerTrainRows.map((r) => dateFrom(r.vector.officialDate).getTime())));
    const minValidationDate = new Date(Math.min(...innerValidationRows.map((r) => dateFrom(r.vector.officialDate).getTime())));
    if (maxTrainDate >= minValidationDate) {
      throw new Error(`Fold ${foldDef.foldId} train dates overlap validation dates`);
    }

    for (const id of validationExampleIds) {
      if (allValidationExampleIds.has(id)) {
        throw new Error(`Duplicate validation identity across folds: ${id}`);
      }
      allValidationExampleIds.add(id);
    }

    for (const date of allTrainDatesInFold) {
      allTrainDates.add(date);
    }
    for (const date of allValidationDatesInFold) {
      allValidationDates.add(date);
    }

    const dateRangeProof =
      `inner train ${foldDef.innerTrainStartDate}..${foldDef.innerTrainEndDate} (${innerTrainRows.length} rows), ` +
      `inner validation ${foldDef.innerValidationStartDate}..${foldDef.innerValidationEndDate} (${innerValidationRows.length} rows), ` +
      'no date overlap';

    folds.push({
      foldId: foldDef.foldId,
      innerTrainRows,
      innerValidationRows,
      trainRowCount: innerTrainRows.length,
      validationRowCount: innerValidationRows.length,
      trainHomeWinCount: trainHomeWins,
      trainAwayWinCount: trainAwayWins,
      validationHomeWinCount: validationHomeWins,
      validationAwayWinCount: validationAwayWins,
      innerTrainDateRange: { startDate: foldDef.innerTrainStartDate, endDate: foldDef.innerTrainEndDate },
      innerValidationDateRange: { startDate: foldDef.innerValidationStartDate, endDate: foldDef.innerValidationEndDate },
      dateRangeProof,
    });
  }

  if (folds.length !== 4) {
    throw new Error(`Expected exactly 4 folds, got ${folds.length}`);
  }

  for (let i = 0; i < folds.length; i++) {
    if (folds[i].foldId !== validatedPlan.folds[i].foldId) {
      throw new Error(`Fold order mismatch at index ${i}`);
    }
  }

  for (let i = 0; i < folds.length; i++) {
    for (let j = i + 1; j < folds.length; j++) {
      const validationEndI = dateFrom(validatedPlan.folds[i].innerValidationEndDate);
      const validationStartJ = dateFrom(validatedPlan.folds[j].innerValidationStartDate);
      if (validationStartJ <= validationEndI) {
        throw new Error(`Validation windows of folds ${folds[i].foldId} and ${folds[j].foldId} overlap`);
      }
    }
  }

  const trainIdsByFold: string[][] = folds.map((f) => f.innerTrainRows.map((r) => r.exampleId));
  for (let i = 1; i < trainIdsByFold.length; i++) {
    const currSet = new Set(trainIdsByFold[i]);
    for (const id of trainIdsByFold[i - 1]) {
      if (!currSet.has(id)) {
        throw new Error(`Expanding window violated: fold ${folds[i].foldId} train set is not a superset of fold ${folds[i - 1].foldId}`);
      }
    }
  }

  const lastFold = folds[folds.length - 1];
  const totalCovered = lastFold.innerTrainRows.length + lastFold.innerValidationRows.length;
  if (totalCovered !== trainRows.rowCount) {
    throw new Error(
      `Fold 4 coverage mismatch: train ${lastFold.innerTrainRows.length} + validation ${lastFold.innerValidationRows.length} !== total ${trainRows.rowCount}`,
    );
  }

  const allCoveredIds = new Set<string>();
  for (const row of lastFold.innerTrainRows) {
    allCoveredIds.add(row.exampleId);
  }
  for (const row of lastFold.innerValidationRows) {
    allCoveredIds.add(row.exampleId);
  }
  if (allCoveredIds.size !== trainRows.rowCount) {
    throw new Error('Not all source TRAIN rows are covered by Fold 4');
  }

  for (const id of allTrainExampleIds) {
    if (!allCoveredIds.has(id)) {
      throw new Error(`Source TRAIN row omitted from Fold 4 coverage: ${id}`);
    }
  }

  const result: MLBTrainOnlyInnerValidationFolds = {
    contractVersion: MLB_TRAIN_ONLY_INNER_VALIDATION_FOLDS_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    matrixId: trainRows.matrixId,
    manifestId: trainRows.manifestId,
    datasetId: trainRows.datasetId,
    foldPlanId: validatedPlan.contractVersion,
    folds,
  };

  const foldsValidation = validateMLBTrainOnlyInnerValidationFolds(result);
  if (!foldsValidation.ok) {
    throw new Error(`Invalid fold result: ${foldsValidation.issues.map((i) => `${i.code}: ${i.message}`).join(', ')}`);
  }

  return foldsValidation.value;
}

const LOG_LOSS_CLIP_MIN = 1e-15;
const LOG_LOSS_CLIP_MAX = 1 - 1e-15;

function clipProbability(p: number): number {
  if (!Number.isFinite(p)) {
    return p;
  }
  if (p < LOG_LOSS_CLIP_MIN) return LOG_LOSS_CLIP_MIN;
  if (p > LOG_LOSS_CLIP_MAX) return LOG_LOSS_CLIP_MAX;
  return p;
}

function computeLogLoss(probability: number, target: number): number {
  const p = clipProbability(probability);
  return -(target * Math.log(p) + (1 - target) * Math.log(1 - p));
}

function computeBrierScore(probability: number, target: number): number {
  return (probability - target) ** 2;
}

function computeBinaryRocAuc(
  probabilities: readonly number[],
  targets: readonly number[],
): number {
  const n = probabilities.length;
  if (n === 0) return 0;

  let positiveCount = 0;
  let negativeCount = 0;
  let rocSum = 0;

  for (let i = 0; i < n; i++) {
    if (targets[i] === 1) positiveCount++;
    else if (targets[i] === 0) negativeCount++;
  }

  if (positiveCount === 0 || negativeCount === 0) return 0;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (targets[i] === 1 && targets[j] === 0) {
        if (probabilities[i] > probabilities[j]) rocSum += 1;
        else if (probabilities[i] === probabilities[j]) rocSum += 0.5;
      } else if (targets[i] === 0 && targets[j] === 1) {
        if (probabilities[i] < probabilities[j]) rocSum += 1;
        else if (probabilities[i] === probabilities[j]) rocSum += 0.5;
      }
    }
  }

  return rocSum / (positiveCount * negativeCount);
}

export function buildMLBInnerDevelopmentReferenceFacts(
  fold: MLBFoldMaterialization,
  context: MLBInnerDevelopmentReferenceProvenance,
): Readonly<{ ok: true; value: MLBInnerDevelopmentReferenceFacts } | { ok: false; issues: readonly MLBInnerFoldMetricResultIssue[] }> {
  const issues: MLBInnerFoldMetricResultIssue[] = [];

  if (!isPlainObject(fold)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.fold', 'fold must be a plain object');
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  if (!Array.isArray(fold.innerTrainRows)) {
    pushIssue(issues, 'INVALID_ARRAY', '$.fold.innerTrainRows', 'innerTrainRows must be an array');
  }
  if (!Array.isArray(fold.innerValidationRows)) {
    pushIssue(issues, 'INVALID_ARRAY', '$.fold.innerValidationRows', 'innerValidationRows must be an array');
  }
  if (typeof fold.foldId !== 'string' || fold.foldId.trim() === '') {
    pushIssue(issues, 'INVALID_STRING', '$.fold.foldId', 'foldId is required');
  }
  if (typeof fold.trainRowCount !== 'number' || !Number.isFinite(fold.trainRowCount) || fold.trainRowCount < 0) {
    pushIssue(issues, 'INVALID_NUMBER', '$.fold.trainRowCount', 'trainRowCount must be a finite non-negative number');
  }
  if (typeof fold.validationRowCount !== 'number' || !Number.isFinite(fold.validationRowCount) || fold.validationRowCount < 0) {
    pushIssue(issues, 'INVALID_NUMBER', '$.fold.validationRowCount', 'validationRowCount must be a finite non-negative number');
  }
  if (typeof fold.trainHomeWinCount !== 'number' || !Number.isFinite(fold.trainHomeWinCount) || fold.trainHomeWinCount < 0) {
    pushIssue(issues, 'INVALID_NUMBER', '$.fold.trainHomeWinCount', 'trainHomeWinCount must be a finite non-negative number');
  }
  if (typeof fold.trainAwayWinCount !== 'number' || !Number.isFinite(fold.trainAwayWinCount) || fold.trainAwayWinCount < 0) {
    pushIssue(issues, 'INVALID_NUMBER', '$.fold.trainAwayWinCount', 'trainAwayWinCount must be a finite non-negative number');
  }
  if (typeof fold.validationHomeWinCount !== 'number' || !Number.isFinite(fold.validationHomeWinCount) || fold.validationHomeWinCount < 0) {
    pushIssue(issues, 'INVALID_NUMBER', '$.fold.validationHomeWinCount', 'validationHomeWinCount must be a finite non-negative number');
  }
  if (typeof fold.validationAwayWinCount !== 'number' || !Number.isFinite(fold.validationAwayWinCount) || fold.validationAwayWinCount < 0) {
    pushIssue(issues, 'INVALID_NUMBER', '$.fold.validationAwayWinCount', 'validationAwayWinCount must be a finite non-negative number');
  }
  if (typeof context.matrixId !== 'string' || context.matrixId.trim() === '') {
    pushIssue(issues, 'INVALID_STRING', '$.context.matrixId', 'matrixId is required');
  }
  if (typeof context.manifestId !== 'string' || context.manifestId.trim() === '') {
    pushIssue(issues, 'INVALID_STRING', '$.context.manifestId', 'manifestId is required');
  }
  if (typeof context.datasetId !== 'string' || context.datasetId.trim() === '') {
    pushIssue(issues, 'INVALID_STRING', '$.context.datasetId', 'datasetId is required');
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  const innerTrainRows = fold.innerTrainRows;
  const innerValidationRows = fold.innerValidationRows;

  if (innerTrainRows.length === 0) {
    pushIssue(issues, 'EMPTY_INNER_TRAIN', '$.fold.innerTrainRows', 'innerTrainRows must not be empty');
  }
  if (innerValidationRows.length === 0) {
    pushIssue(issues, 'EMPTY_INNER_VALIDATION', '$.fold.innerValidationRows', 'innerValidationRows must not be empty');
  }
  if (innerTrainRows.length !== fold.trainRowCount) {
    pushIssue(issues, 'ROW_COUNT_MISMATCH', '$.fold.trainRowCount', `Expected ${innerTrainRows.length}, got ${fold.trainRowCount}`);
  }
  if (innerValidationRows.length !== fold.validationRowCount) {
    pushIssue(issues, 'ROW_COUNT_MISMATCH', '$.fold.validationRowCount', `Expected ${innerValidationRows.length}, got ${fold.validationRowCount}`);
  }

  const trainExampleIds = new Set<string>();
  const validationExampleIds = new Set<string>();
  let trainHomeWins = 0;
  let trainAwayWins = 0;
  let validationHomeWins = 0;
  let validationAwayWins = 0;

  for (const row of innerTrainRows) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', `$.fold.innerTrainRows[?]`, 'Row must be a plain object');
      continue;
    }
    if (typeof row.exampleId !== 'string' || row.exampleId.trim() === '') {
      pushIssue(issues, 'INVALID_STRING', `$.fold.innerTrainRows[${row.exampleId}].exampleId`, 'exampleId is required');
    } else if (trainExampleIds.has(row.exampleId)) {
      pushIssue(issues, 'DUPLICATE_EXAMPLE_ID', `$.fold.innerTrainRows[${row.exampleId}]`, `Duplicate exampleId: ${row.exampleId}`);
    } else {
      trainExampleIds.add(row.exampleId);
    }
    if (row.split !== 'TRAIN') {
      pushIssue(issues, 'NON_TRAIN_SPLIT', `$.fold.innerTrainRows[${row.exampleId}].split`, `Split must be TRAIN, got ${row.split}`);
    }
    if (row.targetValue !== 0 && row.targetValue !== 1) {
      pushIssue(issues, 'INVALID_TARGET_VALUE', `$.fold.innerTrainRows[${row.exampleId}].targetValue`, `targetValue must be 0 or 1, got ${row.targetValue}`);
    } else if (row.targetValue === 1) {
      trainHomeWins++;
    } else {
      trainAwayWins++;
    }
  }

  for (const row of innerValidationRows) {
    if (typeof row !== 'object' || row === null || Array.isArray(row)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', `$.fold.innerValidationRows[?]`, 'Row must be a plain object');
      continue;
    }
    if (typeof row.exampleId !== 'string' || row.exampleId.trim() === '') {
      pushIssue(issues, 'INVALID_STRING', `$.fold.innerValidationRows[${row.exampleId}].exampleId`, 'exampleId is required');
    } else if (validationExampleIds.has(row.exampleId)) {
      pushIssue(issues, 'DUPLICATE_EXAMPLE_ID', `$.fold.innerValidationRows[${row.exampleId}]`, `Duplicate exampleId: ${row.exampleId}`);
    } else {
      validationExampleIds.add(row.exampleId);
    }
    if (row.split !== 'TRAIN') {
      pushIssue(issues, 'NON_TRAIN_SPLIT', `$.fold.innerValidationRows[${row.exampleId}].split`, `Split must be TRAIN, got ${row.split}`);
    }
    if (row.targetValue !== 0 && row.targetValue !== 1) {
      pushIssue(issues, 'INVALID_TARGET_VALUE', `$.fold.innerValidationRows[${row.exampleId}].targetValue`, `targetValue must be 0 or 1, got ${row.targetValue}`);
    } else if (row.targetValue === 1) {
      validationHomeWins++;
    } else {
      validationAwayWins++;
    }
  }

  for (const id of trainExampleIds) {
    if (validationExampleIds.has(id)) {
      pushIssue(issues, 'EXAMPLE_ID_MISMATCH', `$.fold[${id}]`, `exampleId ${id} appears in both innerTrainRows and innerValidationRows`);
    }
  }

  if (trainHomeWins !== fold.trainHomeWinCount) {
    pushIssue(issues, 'TRAIN_COUNT_MISMATCH', '$.fold.trainHomeWinCount', `Expected ${trainHomeWins}, got ${fold.trainHomeWinCount}`);
  }
  if (trainAwayWins !== fold.trainAwayWinCount) {
    pushIssue(issues, 'TRAIN_COUNT_MISMATCH', '$.fold.trainAwayWinCount', `Expected ${trainAwayWins}, got ${fold.trainAwayWinCount}`);
  }
  if (validationHomeWins !== fold.validationHomeWinCount) {
    pushIssue(issues, 'TRAIN_COUNT_MISMATCH', '$.fold.validationHomeWinCount', `Expected ${validationHomeWins}, got ${fold.validationHomeWinCount}`);
  }
  if (validationAwayWins !== fold.validationAwayWinCount) {
    pushIssue(issues, 'TRAIN_COUNT_MISMATCH', '$.fold.validationAwayWinCount', `Expected ${validationAwayWins}, got ${fold.validationAwayWinCount}`);
  }

  if (validationHomeWins === 0 || validationAwayWins === 0) {
    pushIssue(issues, 'CLASS_DEGENERATE', '$.fold.innerValidationRows', 'Both classes must be present in innerValidationRows');
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  const trainPrior = trainHomeWins / innerTrainRows.length;
  const validationN = innerValidationRows.length;

  const p50LogLoss =
    Array.from({ length: validationN }, () => 0.5).reduce((sum, _, i) => sum + computeLogLoss(0.5, innerValidationRows[i].targetValue), 0) / validationN;
  const p50Brier =
    Array.from({ length: validationN }, () => 0.5).reduce((sum, _, i) => sum + computeBrierScore(0.5, innerValidationRows[i].targetValue), 0) / validationN;
  const p50RocAuc = computeBinaryRocAuc(
    Array.from({ length: validationN }, () => 0.5),
    innerValidationRows.map((r) => r.targetValue),
  );

  const priorLogLoss =
    Array.from({ length: validationN }, () => trainPrior).reduce((sum, _, i) => sum + computeLogLoss(trainPrior, innerValidationRows[i].targetValue), 0) / validationN;
  const priorBrier =
    Array.from({ length: validationN }, () => trainPrior).reduce((sum, _, i) => sum + computeBrierScore(trainPrior, innerValidationRows[i].targetValue), 0) / validationN;
  const priorRocAuc = computeBinaryRocAuc(
    Array.from({ length: validationN }, () => trainPrior),
    innerValidationRows.map((r) => r.targetValue),
  );

  return {
    ok: true,
    value: {
      contractVersion: 'mlb-inner-development-reference-facts-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      foldId: fold.foldId,
      matrixId: context.matrixId,
      manifestId: context.manifestId,
      datasetId: context.datasetId,
      innerTrainRowCount: innerTrainRows.length,
      innerValidationRowCount: innerValidationRows.length,
      innerTrainHomeWinCount: trainHomeWins,
      innerTrainAwayWinCount: trainAwayWins,
      innerTrainHomeWinPrior: trainPrior,
      p50: {
        probability: 0.5,
        logLoss: p50LogLoss,
        brierScore: p50Brier,
        rocAuc: p50RocAuc,
      },
      foldTrainPrior: {
        probability: trainPrior,
        logLoss: priorLogLoss,
        brierScore: priorBrier,
        rocAuc: priorRocAuc,
      },
    },
  };
}

export function evaluateMLBInnerFoldMetrics(
  fold: MLBFoldMaterialization,
  predictions: readonly MLBInnerCandidatePredictionRecord[],
  reference: MLBInnerDevelopmentReferenceFacts,
  context: MLBInnerDevelopmentReferenceProvenance,
  optimizerDiagnostics?: MLBInnerFoldOptimizerDiagnostics,
): Readonly<{ ok: true; value: MLBInnerFoldMetricResult } | { ok: false; issues: readonly MLBInnerFoldMetricResultIssue[] }> {
  const issues: MLBInnerFoldMetricResultIssue[] = [];

  if (!isPlainObject(fold)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.fold', 'fold must be a plain object');
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  if (!isPlainObject(reference)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.reference', 'reference must be a plain object');
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  if (!isPlainObject(context)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.context', 'context must be a plain object');
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  // Provenance integrity
  if (reference.matrixId !== context.matrixId) {
    pushIssue(issues, 'PROVENANCE_MISMATCH', '$.reference.matrixId', `Reference matrixId ${reference.matrixId} does not match context matrixId ${context.matrixId}`);
  }
  if (reference.manifestId !== context.manifestId) {
    pushIssue(issues, 'PROVENANCE_MISMATCH', '$.reference.manifestId', `Reference manifestId ${reference.manifestId} does not match context manifestId ${context.manifestId}`);
  }
  if (reference.datasetId !== context.datasetId) {
    pushIssue(issues, 'PROVENANCE_MISMATCH', '$.reference.datasetId', `Reference datasetId ${reference.datasetId} does not match context datasetId ${context.datasetId}`);
  }

  // Reference-fold binding integrity
  if (reference.foldId !== fold.foldId) {
    pushIssue(issues, 'EXAMPLE_ID_MISMATCH', '$.reference.foldId', `Reference foldId ${reference.foldId} does not match fold foldId ${fold.foldId}`);
  }
  if (reference.innerValidationRowCount !== fold.validationRowCount) {
    pushIssue(issues, 'ROW_COUNT_MISMATCH', '$.reference.innerValidationRowCount', `Reference innerValidationRowCount ${reference.innerValidationRowCount} does not match fold validationRowCount ${fold.validationRowCount}`);
  }
  if (reference.innerTrainRowCount !== fold.trainRowCount) {
    pushIssue(issues, 'ROW_COUNT_MISMATCH', '$.reference.innerTrainRowCount', `Reference innerTrainRowCount ${reference.innerTrainRowCount} does not match fold trainRowCount ${fold.trainRowCount}`);
  }
  if (reference.innerTrainHomeWinCount !== fold.trainHomeWinCount) {
    pushIssue(issues, 'TRAIN_COUNT_MISMATCH', '$.reference.innerTrainHomeWinCount', `Reference innerTrainHomeWinCount ${reference.innerTrainHomeWinCount} does not match fold trainHomeWinCount ${fold.trainHomeWinCount}`);
  }
  if (reference.innerTrainAwayWinCount !== fold.trainAwayWinCount) {
    pushIssue(issues, 'TRAIN_COUNT_MISMATCH', '$.reference.innerTrainAwayWinCount', `Reference innerTrainAwayWinCount ${reference.innerTrainAwayWinCount} does not match fold trainAwayWinCount ${fold.trainAwayWinCount}`);
  }
  const expectedPrior = fold.trainHomeWinCount / fold.trainRowCount;
  if (reference.innerTrainHomeWinPrior !== expectedPrior) {
    pushIssue(issues, 'PRIOR_MISMATCH', '$.reference.innerTrainHomeWinPrior', `Reference prior ${reference.innerTrainHomeWinPrior} does not match fold prior ${expectedPrior}`);
  }
  if (reference.p50.probability !== 0.5) {
    pushIssue(issues, 'P50_PROBABILITY_MISMATCH', '$.reference.p50.probability', `Reference p50 probability ${reference.p50.probability} must be 0.5`);
  }
  if (reference.foldTrainPrior.probability !== expectedPrior) {
    pushIssue(issues, 'PRIOR_MISMATCH', '$.reference.foldTrainPrior.probability', `Reference foldTrainPrior probability ${reference.foldTrainPrior.probability} does not match fold prior ${expectedPrior}`);
  }

  if (optimizerDiagnostics !== undefined) {
    if (!isPlainObject(optimizerDiagnostics)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.optimizerDiagnostics', 'optimizerDiagnostics must be a plain object');
      return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
    }
    if (typeof optimizerDiagnostics.converged !== 'boolean') {
      pushIssue(issues, 'INVALID_BOOLEAN', '$.optimizerDiagnostics.converged', 'converged must be a boolean');
    }
    if (typeof optimizerDiagnostics.iterationsCompleted !== 'number' || !Number.isInteger(optimizerDiagnostics.iterationsCompleted) || optimizerDiagnostics.iterationsCompleted <= 0) {
      pushIssue(issues, 'INVALID_INTEGER', '$.optimizerDiagnostics.iterationsCompleted', 'iterationsCompleted must be a positive integer');
    }
    if (typeof optimizerDiagnostics.finalTrainingObjective !== 'number' || !Number.isFinite(optimizerDiagnostics.finalTrainingObjective)) {
      pushIssue(issues, 'NONFINITE_METRIC', '$.optimizerDiagnostics.finalTrainingObjective', 'finalTrainingObjective must be a finite number');
    }
    if (issues.length > 0) {
      return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  if (fold.validationRowCount === 0) {
    pushIssue(issues, 'EMPTY_INNER_VALIDATION', '$.fold.innerValidationRows', 'innerValidationRows must not be empty');
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  if (fold.validationHomeWinCount === 0 || fold.validationAwayWinCount === 0) {
    pushIssue(issues, 'CLASS_DEGENERATE', '$.fold.innerValidationRows', 'Both classes must be present in innerValidationRows');
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  if (predictions.length !== fold.validationRowCount) {
    pushIssue(issues, 'PREDICTION_COUNT_MISMATCH', '$', `Expected ${fold.validationRowCount} predictions, got ${predictions.length}`);
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  const seenExampleIds = new Set<string>();
  const validationById = new Map<string, MLBOuterTrainRow>();
  for (const row of fold.innerValidationRows) {
    validationById.set(row.exampleId, row);
  }

  const aligned: Array<{ target: number; probability: number }> = [];
  let firstCandidateRecipeId: string | null = null;
  let mixedCandidateRecipeId = false;
  let mixedFoldId = false;

  for (const pred of predictions) {
    if (!isStrictNonEmptyTrimmedString(pred.candidateRecipeId)) {
      pushIssue(issues, 'INVALID_STRING', `$.predictions[${typeof pred.exampleId === 'string' ? pred.exampleId : '?'}].candidateRecipeId`, 'candidateRecipeId is required');
    } else if (firstCandidateRecipeId === null) {
      firstCandidateRecipeId = pred.candidateRecipeId;
    } else if (pred.candidateRecipeId !== firstCandidateRecipeId) {
      mixedCandidateRecipeId = true;
    }

    if (!isStrictNonEmptyTrimmedString(pred.exampleId)) {
      pushIssue(issues, 'MISSING_EXAMPLE_ID', `$.predictions[${typeof pred.exampleId === 'string' ? pred.exampleId : '?'}].exampleId`, 'exampleId is required');
      continue;
    }
    if (seenExampleIds.has(pred.exampleId)) {
      pushIssue(issues, 'DUPLICATE_EXAMPLE_ID', `$.predictions[${pred.exampleId}]`, `Duplicate exampleId: ${pred.exampleId}`);
      continue;
    }
    seenExampleIds.add(pred.exampleId);

    const targetRow = validationById.get(pred.exampleId);
    if (!targetRow) {
      pushIssue(issues, 'FOREIGN_EXAMPLE_ID', `$.predictions[${pred.exampleId}].exampleId`, `exampleId ${pred.exampleId} not found in fold innerValidationRows`);
      continue;
    }

    if (pred.foldId !== fold.foldId) {
      pushIssue(issues, 'EXAMPLE_ID_MISMATCH', `$.predictions[${pred.exampleId}].foldId`, `Prediction foldId ${pred.foldId} does not match fold foldId ${fold.foldId}`);
      mixedFoldId = true;
    }

    if (typeof pred.homeWinProbability !== 'number' || !Number.isFinite(pred.homeWinProbability)) {
      pushIssue(issues, 'NONFINITE_PROBABILITY', `$.predictions[${pred.exampleId}].homeWinProbability`, 'homeWinProbability must be finite');
      continue;
    }
    if (pred.homeWinProbability < 0 || pred.homeWinProbability > 1) {
      pushIssue(issues, 'OUT_OF_RANGE_PROBABILITY', `$.predictions[${pred.exampleId}].homeWinProbability`, 'homeWinProbability must be in [0, 1]');
      continue;
    }

    aligned.push({
      target: targetRow.targetValue,
      probability: pred.homeWinProbability,
    });
  }

  if (mixedCandidateRecipeId) {
    pushIssue(issues, 'MIXED_CANDIDATE_RECIPE_ID', '$.predictions', 'All predictions must agree on candidateRecipeId');
  }
  if (mixedFoldId) {
    pushIssue(issues, 'MIXED_FOLD_ID', '$.predictions', 'All predictions must agree on the validated foldId');
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  const rowCount = aligned.length;
  const targetHomeWinCount = aligned.filter((a) => a.target === 1).length;
  const targetAwayWinCount = aligned.filter((a) => a.target === 0).length;

  const probabilities = aligned.map((a) => a.probability);
  const targets = aligned.map((a) => a.target);

  let candidateLogLossSum = 0;
  let candidateBrierSum = 0;
  for (let i = 0; i < rowCount; i++) {
    candidateLogLossSum += computeLogLoss(probabilities[i], targets[i]);
    candidateBrierSum += computeBrierScore(probabilities[i], targets[i]);
  }
  const candidateLogLoss = rowCount > 0 ? candidateLogLossSum / rowCount : 0;
  const candidateBrierScore = rowCount > 0 ? candidateBrierSum / rowCount : 0;
  const candidateRocAuc = computeBinaryRocAuc(probabilities, targets);

  if (!Number.isFinite(candidateLogLoss)) {
    pushIssue(issues, 'NONFINITE_METRIC', '$.candidateLogLoss', 'Non-finite candidateLogLoss');
  }
  if (!Number.isFinite(candidateBrierScore)) {
    pushIssue(issues, 'NONFINITE_METRIC', '$.candidateBrierScore', 'Non-finite candidateBrierScore');
  }
  if (!Number.isFinite(candidateRocAuc)) {
    pushIssue(issues, 'NONFINITE_METRIC', '$.candidateRocAuc', 'Non-finite candidateRocAuc');
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerFoldMetricResultIssue[] };
  }

  // Recompute reference metrics from the validated fold so forged reference metrics cannot change the result.
  const validationN = fold.innerValidationRows.length;
  const p50LogLoss =
    Array.from({ length: validationN }, () => 0.5).reduce((sum, _, i) => sum + computeLogLoss(0.5, fold.innerValidationRows[i].targetValue), 0) / validationN;
  const p50BrierScore =
    Array.from({ length: validationN }, () => 0.5).reduce((sum, _, i) => sum + computeBrierScore(0.5, fold.innerValidationRows[i].targetValue), 0) / validationN;
  const p50RocAuc = computeBinaryRocAuc(
    Array.from({ length: validationN }, () => 0.5),
    fold.innerValidationRows.map((r) => r.targetValue),
  );

  const priorLogLoss =
    Array.from({ length: validationN }, () => expectedPrior).reduce((sum, _, i) => sum + computeLogLoss(expectedPrior, fold.innerValidationRows[i].targetValue), 0) / validationN;
  const priorBrierScore =
    Array.from({ length: validationN }, () => expectedPrior).reduce((sum, _, i) => sum + computeBrierScore(expectedPrior, fold.innerValidationRows[i].targetValue), 0) / validationN;
  const priorRocAuc = computeBinaryRocAuc(
    Array.from({ length: validationN }, () => expectedPrior),
    fold.innerValidationRows.map((r) => r.targetValue),
  );

  const result: MLBInnerFoldMetricResult = {
    contractVersion: 'mlb-inner-fold-metric-result-v1',
    foldId: fold.foldId,
    candidateRecipeId: firstCandidateRecipeId ?? '',
    rowCount,
    targetHomeWinCount,
    targetAwayWinCount,
    candidateLogLoss,
    candidateBrierScore,
    candidateRocAuc,
    p50LogLoss,
    p50BrierScore,
    p50RocAuc,
    foldTrainPriorLogLoss: priorLogLoss,
    foldTrainPriorBrierScore: priorBrierScore,
    foldTrainPriorRocAuc: priorRocAuc,
    foldTrainPriorProbability: expectedPrior,
    ...(optimizerDiagnostics !== undefined ? { optimizerDiagnostics } : {}),
  };

  return { ok: true, value: result };
}

const CANONICAL_FOLD_IDS = ['FOLD_1', 'FOLD_2', 'FOLD_3', 'FOLD_4'] as const;

type CanonicalFoldEntry = {
  foldId: string;
  validationRowCount: number;
  validationHomeWinCount: number;
  validationAwayWinCount: number;
  trainPrior: number;
};

function buildCanonicalFoldLookup(): ReadonlyMap<string, CanonicalFoldEntry> {
  const plan = MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN;
  const map = new Map<string, CanonicalFoldEntry>();
  for (const def of plan.folds) {
    map.set(def.foldId, {
      foldId: def.foldId,
      validationRowCount: def.expectedValidationRowCount,
      validationHomeWinCount: def.expectedValidationHomeWinCount,
      validationAwayWinCount: def.expectedValidationAwayWinCount,
      trainPrior: def.expectedTrainHomeWinCount / def.expectedTrainRowCount,
    });
  }
  return map;
}

const CANONICAL_FOLD_LOOKUP = buildCanonicalFoldLookup();

function validateAggregateFoldResult(
  fold: MLBInnerFoldMetricResult,
  canonical: CanonicalFoldEntry,
  candidateRecipeId: string,
  issues: MLBInnerAggregateResultIssue[],
): void {
  if (fold.candidateRecipeId !== candidateRecipeId) {
    pushIssue(
      issues,
      'IDENTITY_MISMATCH',
      `$.${fold.foldId}.candidateRecipeId`,
      `Fold ${fold.foldId} candidateRecipeId ${fold.candidateRecipeId} does not match ${candidateRecipeId}`,
    );
  }

  if (fold.contractVersion !== 'mlb-inner-fold-metric-result-v1') {
    pushIssue(
      issues,
      'INVALID_FOLD_SET',
      `$.${fold.foldId}.contractVersion`,
      `Fold ${fold.foldId} contractVersion ${fold.contractVersion} is invalid`,
    );
  }

  if (typeof fold.rowCount !== 'number' || !Number.isFinite(fold.rowCount) || fold.rowCount <= 0) {
    pushIssue(issues, 'ROW_COUNT_MISMATCH', `$.${fold.foldId}.rowCount`, `Fold ${fold.foldId} rowCount must be a positive integer`);
  } else if (fold.rowCount !== canonical.validationRowCount) {
    pushIssue(
      issues,
      'ROW_COUNT_MISMATCH',
      `$.${fold.foldId}.rowCount`,
      `Fold ${fold.foldId} rowCount ${fold.rowCount} does not match canonical ${canonical.validationRowCount}`,
    );
  }

  if (fold.targetHomeWinCount + fold.targetAwayWinCount !== fold.rowCount) {
    pushIssue(
      issues,
      'CLASS_COUNT_MISMATCH',
      `$.${fold.foldId}.targetHomeWinCount`,
      `Fold ${fold.foldId} targetHomeWinCount + targetAwayWinCount !== rowCount`,
    );
  }

  if (fold.targetHomeWinCount !== canonical.validationHomeWinCount) {
    pushIssue(
      issues,
      'CLASS_COUNT_MISMATCH',
      `$.${fold.foldId}.targetHomeWinCount`,
      `Fold ${fold.foldId} targetHomeWinCount ${fold.targetHomeWinCount} does not match canonical ${canonical.validationHomeWinCount}`,
    );
  }

  if (fold.targetAwayWinCount !== canonical.validationAwayWinCount) {
    pushIssue(
      issues,
      'CLASS_COUNT_MISMATCH',
      `$.${fold.foldId}.targetAwayWinCount`,
      `Fold ${fold.foldId} targetAwayWinCount ${fold.targetAwayWinCount} does not match canonical ${canonical.validationAwayWinCount}`,
    );
  }

  if (fold.foldTrainPriorProbability !== canonical.trainPrior) {
    pushIssue(
      issues,
      'TRAIN_PRIOR_MISMATCH',
      `$.${fold.foldId}.foldTrainPriorProbability`,
      `Fold ${fold.foldId} foldTrainPriorProbability ${fold.foldTrainPriorProbability} does not match canonical ${canonical.trainPrior}`,
    );
  }

  const metrics: Array<{ value: number; path: string; name: string; min?: number; max?: number }> = [
    { value: fold.candidateLogLoss, path: `$.${fold.foldId}.candidateLogLoss`, name: 'candidateLogLoss', min: 0 },
    { value: fold.candidateBrierScore, path: `$.${fold.foldId}.candidateBrierScore`, name: 'candidateBrierScore', min: 0, max: 1 },
    { value: fold.candidateRocAuc, path: `$.${fold.foldId}.candidateRocAuc`, name: 'candidateRocAuc', min: 0, max: 1 },
    { value: fold.p50LogLoss, path: `$.${fold.foldId}.p50LogLoss`, name: 'p50LogLoss', min: 0 },
    { value: fold.p50BrierScore, path: `$.${fold.foldId}.p50BrierScore`, name: 'p50BrierScore', min: 0, max: 1 },
    { value: fold.p50RocAuc, path: `$.${fold.foldId}.p50RocAuc`, name: 'p50RocAuc', min: 0, max: 1 },
    { value: fold.foldTrainPriorLogLoss, path: `$.${fold.foldId}.foldTrainPriorLogLoss`, name: 'foldTrainPriorLogLoss', min: 0 },
    { value: fold.foldTrainPriorBrierScore, path: `$.${fold.foldId}.foldTrainPriorBrierScore`, name: 'foldTrainPriorBrierScore', min: 0, max: 1 },
    { value: fold.foldTrainPriorRocAuc, path: `$.${fold.foldId}.foldTrainPriorRocAuc`, name: 'foldTrainPriorRocAuc', min: 0, max: 1 },
  ];

  for (const metric of metrics) {
    if (!Number.isFinite(metric.value)) {
      pushIssue(issues, 'NONFINITE_METRIC', metric.path, `Fold ${fold.foldId} ${metric.name} must be finite`);
    } else if (metric.min !== undefined && metric.value < metric.min) {
      pushIssue(issues, 'NONFINITE_METRIC', metric.path, `Fold ${fold.foldId} ${metric.name} must be >= ${metric.min}`);
    } else if (metric.max !== undefined && metric.value > metric.max) {
      pushIssue(issues, 'NONFINITE_METRIC', metric.path, `Fold ${fold.foldId} ${metric.name} must be <= ${metric.max}`);
    }
  }

  // P50 reference metrics are derived canonically in the aggregate evaluator;
  // domain validation above is sufficient here so legal-but-wrong caller-supplied
  // reference values do not cause fold-set rejection.
}

function computeCanonicalFoldReferenceMetrics(canonical: CanonicalFoldEntry): {
  p50LogLoss: number;
  p50BrierScore: number;
  p50RocAuc: number;
  foldTrainPriorLogLoss: number;
  foldTrainPriorBrierScore: number;
  foldTrainPriorRocAuc: number;
} {
  const p = canonical.trainPrior;
  const home = canonical.validationHomeWinCount;
  const away = canonical.validationAwayWinCount;
  const rowCount = canonical.validationRowCount;
  return {
    p50LogLoss: -Math.log(0.5),
    p50BrierScore: 0.25,
    p50RocAuc: 0.5,
    foldTrainPriorLogLoss: -(home * Math.log(p) + away * Math.log(1 - p)) / rowCount,
    foldTrainPriorBrierScore: (((p - 1) ** 2) * home + ((p - 0) ** 2) * away) / rowCount,
    foldTrainPriorRocAuc: 0.5,
  };
}

function computeCanonicalAggregateTrainPriorMetrics(): {
  aggregateFoldTrainPriorLogLoss: number;
  aggregateFoldTrainPriorBrierScore: number;
  aggregateFoldTrainPriorRocAuc: number;
} {
  let weightedLogLossSum = 0;
  let weightedBrierSum = 0;
  let totalWeight = 0;
  for (const canonical of CANONICAL_FOLD_IDS) {
    const entry = CANONICAL_FOLD_LOOKUP.get(canonical) as CanonicalFoldEntry;
    const metrics = computeCanonicalFoldReferenceMetrics(entry);
    weightedLogLossSum += metrics.foldTrainPriorLogLoss * entry.validationRowCount;
    weightedBrierSum += metrics.foldTrainPriorBrierScore * entry.validationRowCount;
    totalWeight += entry.validationRowCount;
  }
  return {
    aggregateFoldTrainPriorLogLoss: weightedLogLossSum / totalWeight,
    aggregateFoldTrainPriorBrierScore: weightedBrierSum / totalWeight,
    aggregateFoldTrainPriorRocAuc: 0.5,
  };
}

const CANONICAL_AGGREGATE_TRAIN_PRIOR_METRICS = computeCanonicalAggregateTrainPriorMetrics();

function classifyInnerCandidateGate(
  aggregateResult: MLBInnerAggregateResult,
): Readonly<{ ok: true; value: MLBInnerCandidateGateResult } | { ok: false; issues: readonly MLBInnerCandidateGateResultIssue[] }> {
  const issues: MLBInnerCandidateGateResultIssue[] = [];

  if (!isPlainObject(aggregateResult)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$.aggregateResult', 'aggregateResult must be a plain object');
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerCandidateGateResultIssue[] };
  }

  if (aggregateResult.contractVersion !== 'mlb-inner-aggregate-result-v1') {
    pushIssue(issues, 'INVALID_LITERAL', '$.contractVersion', 'contractVersion must be mlb-inner-aggregate-result-v1');
  }

  const requiredFields: Array<{ key: string; value: unknown }> = [
    { key: 'candidateRecipeId', value: aggregateResult.candidateRecipeId },
    { key: 'aggregateCandidateLogLoss', value: aggregateResult.aggregateCandidateLogLoss },
    { key: 'aggregateCandidateBrierScore', value: aggregateResult.aggregateCandidateBrierScore },
    { key: 'aggregateP50LogLoss', value: aggregateResult.aggregateP50LogLoss },
    { key: 'aggregateP50BrierScore', value: aggregateResult.aggregateP50BrierScore },
    { key: 'aggregateFoldTrainPriorLogLoss', value: aggregateResult.aggregateFoldTrainPriorLogLoss },
    { key: 'aggregateFoldTrainPriorBrierScore', value: aggregateResult.aggregateFoldTrainPriorBrierScore },
  ];

  for (const field of requiredFields) {
    if (typeof field.value !== 'string' && typeof field.value !== 'number') {
      pushIssue(issues, 'MISSING_FIELD', `$.${field.key}`, `${field.key} is required`);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerCandidateGateResultIssue[] };
  }

  if (aggregateResult.aggregateP50LogLoss !== -Math.log(0.5)) {
    pushIssue(
      issues,
      'P50_REFERENCE_MISMATCH',
      '$.aggregateP50LogLoss',
      `aggregateP50LogLoss ${aggregateResult.aggregateP50LogLoss} does not match canonical P50 ${-Math.log(0.5)}`,
    );
  }
  if (aggregateResult.aggregateP50BrierScore !== 0.25) {
    pushIssue(issues, 'P50_REFERENCE_MISMATCH', '$.aggregateP50BrierScore', 'aggregateP50BrierScore must be 0.25');
  }
  if (aggregateResult.aggregateP50RocAuc !== 0.5) {
    pushIssue(issues, 'P50_REFERENCE_MISMATCH', '$.aggregateP50RocAuc', 'aggregateP50RocAuc must be 0.5');
  }
  if (aggregateResult.aggregateFoldTrainPriorRocAuc !== 0.5) {
    pushIssue(issues, 'TRAIN_PRIOR_MISMATCH', '$.aggregateFoldTrainPriorRocAuc', 'aggregateFoldTrainPriorRocAuc must be 0.5');
  }
  if (aggregateResult.aggregateFoldTrainPriorLogLoss !== CANONICAL_AGGREGATE_TRAIN_PRIOR_METRICS.aggregateFoldTrainPriorLogLoss) {
    pushIssue(
      issues,
      'TRAIN_PRIOR_MISMATCH',
      '$.aggregateFoldTrainPriorLogLoss',
      `aggregateFoldTrainPriorLogLoss ${aggregateResult.aggregateFoldTrainPriorLogLoss} does not match canonical aggregate train-prior log loss ${CANONICAL_AGGREGATE_TRAIN_PRIOR_METRICS.aggregateFoldTrainPriorLogLoss}`,
    );
  }
  if (aggregateResult.aggregateFoldTrainPriorBrierScore !== CANONICAL_AGGREGATE_TRAIN_PRIOR_METRICS.aggregateFoldTrainPriorBrierScore) {
    pushIssue(
      issues,
      'TRAIN_PRIOR_MISMATCH',
      '$.aggregateFoldTrainPriorBrierScore',
      `aggregateFoldTrainPriorBrierScore ${aggregateResult.aggregateFoldTrainPriorBrierScore} does not match canonical aggregate train-prior Brier ${CANONICAL_AGGREGATE_TRAIN_PRIOR_METRICS.aggregateFoldTrainPriorBrierScore}`,
    );
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerCandidateGateResultIssue[] };
  }

  const reasons: string[] = [];

  if (!(aggregateResult.aggregateCandidateLogLoss < aggregateResult.aggregateP50LogLoss)) {
    reasons.push('AGGREGATE_LOG_LOSS_NOT_BETTER_THAN_P50');
  }
  if (!(aggregateResult.aggregateCandidateLogLoss < aggregateResult.aggregateFoldTrainPriorLogLoss)) {
    reasons.push('AGGREGATE_LOG_LOSS_NOT_BETTER_THAN_TRAIN_PRIOR');
  }
  if (!(aggregateResult.aggregateCandidateBrierScore < aggregateResult.aggregateP50BrierScore)) {
    reasons.push('AGGREGATE_BRIER_NOT_BETTER_THAN_P50');
  }
  if (!(aggregateResult.aggregateCandidateBrierScore < aggregateResult.aggregateFoldTrainPriorBrierScore)) {
    reasons.push('AGGREGATE_BRIER_NOT_BETTER_THAN_TRAIN_PRIOR');
  }

  const eligible = reasons.length === 0;
  const eligibility: 'INNER_ELIGIBLE' | 'INNER_REJECTED' = eligible ? 'INNER_ELIGIBLE' : 'INNER_REJECTED';

  return {
    ok: true,
    value: {
      eligibility,
      reasons,
    },
  };
}

export function evaluateMLBTrainOnlyInnerCandidate(
  foldResults: readonly MLBInnerFoldMetricResult[],
): Readonly<{ ok: true; value: MLBInnerAggregateResult } | { ok: false; issues: readonly MLBInnerAggregateResultIssue[] }> {
  const issues: MLBInnerAggregateResultIssue[] = [];

  if (!Array.isArray(foldResults)) {
    pushIssue(issues, 'INVALID_ARRAY', '$.foldResults', 'foldResults must be an array');
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerAggregateResultIssue[] };
  }

  if (foldResults.length !== 4) {
    pushIssue(issues, 'INVALID_FOLD_SET', '$.foldResults.length', `Expected exactly 4 fold results, got ${foldResults.length}`);
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerAggregateResultIssue[] };
  }

  const seenFoldIds = new Set<string>();
  let candidateRecipeId: string | null = null;

  for (const fold of foldResults) {
    if (!isPlainObject(fold)) {
      pushIssue(issues, 'NOT_PLAIN_OBJECT', `$.${typeof fold === 'object' && fold !== null && typeof (fold as Record<string, unknown>).foldId === 'string' ? (fold as Record<string, unknown>).foldId : '?'}`, 'fold result must be a plain object');
      continue;
    }
    const rawFoldId = (fold as Record<string, unknown>).foldId;
    if (typeof rawFoldId !== 'string') {
      pushIssue(issues, 'INVALID_STRING', '$.foldId', 'foldId is required');
      continue;
    }
    if (!isStrictNonEmptyTrimmedString(rawFoldId)) {
      pushIssue(issues, 'INVALID_STRING', '$.foldId', 'foldId must be a non-empty trimmed string');
      continue;
    }
    if (!CANONICAL_FOLD_LOOKUP.has(rawFoldId)) {
      pushIssue(issues, 'FOREIGN_FOLD', `$.${rawFoldId}`, `Foreign foldId ${rawFoldId}`);
      continue;
    }
    if (seenFoldIds.has(rawFoldId)) {
      pushIssue(issues, 'DUPLICATE_FOLD', `$.${rawFoldId}`, `Duplicate foldId ${rawFoldId}`);
      continue;
    }
    seenFoldIds.add(rawFoldId);

    const rawCandidateRecipeId = (fold as Record<string, unknown>).candidateRecipeId;
    if (typeof rawCandidateRecipeId !== 'string' || rawCandidateRecipeId.trim() === '') {
      pushIssue(issues, 'INVALID_STRING', `$.${rawFoldId}.candidateRecipeId`, `Fold ${rawFoldId} candidateRecipeId must be a non-empty string`);
    } else if (candidateRecipeId === null) {
      candidateRecipeId = rawCandidateRecipeId;
    } else if (candidateRecipeId !== rawCandidateRecipeId) {
      pushIssue(issues, 'IDENTITY_MISMATCH', '$.candidateRecipeId', `Mixed candidateRecipeId: ${candidateRecipeId} vs ${rawCandidateRecipeId}`);
    }
  }

  if (candidateRecipeId === null) {
    pushIssue(issues, 'IDENTITY_MISMATCH', '$.candidateRecipeId', 'candidateRecipeId is required across all folds');
  }

  for (const expectedId of CANONICAL_FOLD_IDS) {
    if (!seenFoldIds.has(expectedId)) {
      pushIssue(issues, 'MISSING_FOLD', `$.${expectedId}`, `Missing canonical fold ${expectedId}`);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerAggregateResultIssue[] };
  }

  const canonicalFolds = CANONICAL_FOLD_IDS.map((id) => CANONICAL_FOLD_LOOKUP.get(id) as CanonicalFoldEntry);
  const foldById = new Map<string, MLBInnerFoldMetricResult>();
  for (const fold of foldResults) {
    foldById.set(fold.foldId, fold);
  }

  for (const canonical of canonicalFolds) {
    const fold = foldById.get(canonical.foldId) as MLBInnerFoldMetricResult;
    validateAggregateFoldResult(fold, canonical, candidateRecipeId as string, issues);
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) as readonly MLBInnerAggregateResultIssue[] };
  }

  let weightedCandidateLogLossSum = 0;
  let weightedCandidateBrierSum = 0;
  let weightedCandidateRocAucSum = 0;
  let weightedP50LogLossSum = 0;
  let weightedP50BrierSum = 0;
  let weightedP50RocAucSum = 0;
  let weightedFoldTrainPriorLogLossSum = 0;
  let weightedFoldTrainPriorBrierSum = 0;
  let weightedFoldTrainPriorRocAucSum = 0;
  let totalWeight = 0;
  let worstFoldCandidateLogLoss = -Infinity;
  let worstFoldCandidateBrierScore = -Infinity;
  let foldsBeatingP50OnLogLoss = 0;
  let foldsBeatingP50OnBrier = 0;
  let foldsBeatingFoldTrainPriorOnLogLoss = 0;
  let foldsBeatingFoldTrainPriorOnBrier = 0;

  for (const canonical of canonicalFolds) {
    const fold = foldById.get(canonical.foldId) as MLBInnerFoldMetricResult;
    const weight = canonical.validationRowCount;
    const canonicalRefs = computeCanonicalFoldReferenceMetrics(canonical);
    totalWeight += weight;

    weightedCandidateLogLossSum += fold.candidateLogLoss * weight;
    weightedCandidateBrierSum += fold.candidateBrierScore * weight;
    weightedCandidateRocAucSum += fold.candidateRocAuc * weight;
    weightedP50LogLossSum += canonicalRefs.p50LogLoss * weight;
    weightedP50BrierSum += canonicalRefs.p50BrierScore * weight;
    weightedP50RocAucSum += canonicalRefs.p50RocAuc * weight;
    weightedFoldTrainPriorLogLossSum += canonicalRefs.foldTrainPriorLogLoss * weight;
    weightedFoldTrainPriorBrierSum += canonicalRefs.foldTrainPriorBrierScore * weight;
    weightedFoldTrainPriorRocAucSum += canonicalRefs.foldTrainPriorRocAuc * weight;

    if (fold.candidateLogLoss > worstFoldCandidateLogLoss) worstFoldCandidateLogLoss = fold.candidateLogLoss;
    if (fold.candidateBrierScore > worstFoldCandidateBrierScore) worstFoldCandidateBrierScore = fold.candidateBrierScore;
    if (fold.candidateLogLoss < canonicalRefs.p50LogLoss) foldsBeatingP50OnLogLoss++;
    if (fold.candidateBrierScore < canonicalRefs.p50BrierScore) foldsBeatingP50OnBrier++;
    if (fold.candidateLogLoss < canonicalRefs.foldTrainPriorLogLoss) foldsBeatingFoldTrainPriorOnLogLoss++;
    if (fold.candidateBrierScore < canonicalRefs.foldTrainPriorBrierScore) foldsBeatingFoldTrainPriorOnBrier++;
  }

  const aggregateCandidateLogLoss = weightedCandidateLogLossSum / totalWeight;
  const aggregateCandidateBrierScore = weightedCandidateBrierSum / totalWeight;
  const aggregateCandidateRocAuc = weightedCandidateRocAucSum / totalWeight;
  const aggregateP50LogLoss = weightedP50LogLossSum / totalWeight;
  const aggregateP50BrierScore = weightedP50BrierSum / totalWeight;
  const aggregateP50RocAuc = weightedP50RocAucSum / totalWeight;
  const aggregateFoldTrainPriorLogLoss = weightedFoldTrainPriorLogLossSum / totalWeight;
  const aggregateFoldTrainPriorBrierScore = weightedFoldTrainPriorBrierSum / totalWeight;
  const aggregateFoldTrainPriorRocAuc = weightedFoldTrainPriorRocAucSum / totalWeight;

  const aggregateValidationRowCount = canonicalFolds.reduce((sum, f) => sum + f.validationRowCount, 0);

  const result: MLBInnerAggregateResult = {
    contractVersion: 'mlb-inner-aggregate-result-v1',
    candidateRecipeId: candidateRecipeId as string,
    foldCount: 4,
    aggregateValidationRowCount,
    aggregateCandidateLogLoss,
    aggregateCandidateBrierScore,
    aggregateCandidateRocAuc,
    aggregateP50LogLoss,
    aggregateP50BrierScore,
    aggregateP50RocAuc,
    aggregateFoldTrainPriorLogLoss,
    aggregateFoldTrainPriorBrierScore,
    aggregateFoldTrainPriorRocAuc,
    worstFoldCandidateLogLoss,
    worstFoldCandidateBrierScore,
    foldsBeatingP50OnLogLoss,
    foldsBeatingP50OnBrier,
    foldsBeatingFoldTrainPriorOnLogLoss,
    foldsBeatingFoldTrainPriorOnBrier,
  };

  return { ok: true, value: result };
}

export function evaluateMLBTrainOnlyInnerCandidateGate(
  foldResults: readonly MLBInnerFoldMetricResult[],
): Readonly<{ ok: true; value: MLBInnerCandidateGateResult } | { ok: false; issues: readonly MLBInnerCandidateGateResultIssue[] }> {
  const aggregateResult = evaluateMLBTrainOnlyInnerCandidate(foldResults);

  if (!aggregateResult.ok) {
    const firstIssue = aggregateResult.issues[0];
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_FOLD_RESULT',
          path: firstIssue?.path ?? '$.foldResults',
          message: firstIssue?.message ?? 'Invalid fold results',
        } as MLBInnerCandidateGateResultIssue,
      ],
    };
  }

  return classifyInnerCandidateGate(aggregateResult.value);
}

function isJSONSafeValue(
  value: unknown,
  path: string,
  issues: MLBInnerCandidateRecipeFingerprintIssue[],
  seen: WeakSet<object> = new WeakSet(),
): boolean {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return true;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      pushIssue(issues, 'NONFINITE_NUMBER', path, `${path} must be a finite number`);
      return false;
    }
    return true;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      pushIssue(issues, 'CYCLIC_STRUCTURE', path, `${path} is a cyclic structure`);
      return false;
    }
    seen.add(value);
    try {
      for (let i = 0; i < value.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, i);
        if (!descriptor) {
          continue;
        }
        if (!isDataDescriptor(descriptor)) {
          pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${i}]`, `${path}[${i}] is an accessor property`);
          return false;
        }
        if (!isJSONSafeValue(descriptor.value, `${path}[${i}]`, issues, seen)) {
          return false;
        }
      }
      return true;
    } finally {
      seen.delete(value);
    }
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) {
      pushIssue(issues, 'CYCLIC_STRUCTURE', path, `${path} is a cyclic structure`);
      return false;
    }
    seen.add(value);
    try {
      const symbols = Object.getOwnPropertySymbols(value);
      for (const sym of symbols) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}.${String(sym)}`, `${path} contains a symbol-keyed property`);
        return false;
      }
      const keys = Object.getOwnPropertyNames(value);
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!isDataDescriptor(descriptor)) {
          pushIssue(issues, 'INVALID_JSON_VALUE', `${path}.${key}`, `${path}.${key} is an accessor property`);
          return false;
        }
        if (!isJSONSafeValue(descriptor.value, `${path}.${key}`, issues, seen)) {
          return false;
        }
      }
      return true;
    } finally {
      seen.delete(value);
    }
  }
  if (typeof value === 'undefined') {
    pushIssue(issues, 'INVALID_JSON_VALUE', path, `${path} is undefined`);
  } else if (typeof value === 'bigint') {
    pushIssue(issues, 'INVALID_JSON_VALUE', path, `${path} is bigint`);
  } else if (typeof value === 'symbol') {
    pushIssue(issues, 'INVALID_JSON_VALUE', path, `${path} is symbol`);
  } else if (typeof value === 'function') {
    pushIssue(issues, 'INVALID_JSON_VALUE', path, `${path} is function`);
  } else {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, `${path} is not a plain object`);
  }
  return false;
}

function canonicalizeJSONSafeValue(value: unknown, seen: WeakSet<object> = new WeakSet()): unknown {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return null;
    }
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return null;
    }
    seen.add(value);
    try {
      const result: unknown[] = [];
      for (let i = 0; i < value.length; i++) {
        const descriptor = Object.getOwnPropertyDescriptor(value, i);
        if (!descriptor) {
          result[i] = null;
        } else if (!isDataDescriptor(descriptor)) {
          return null;
        } else {
          result[i] = canonicalizeJSONSafeValue(descriptor.value, seen);
        }
      }
      return result;
    } finally {
      seen.delete(value);
    }
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) {
      return null;
    }
    seen.add(value);
    try {
      const symbols = Object.getOwnPropertySymbols(value);
      if (symbols.length > 0) {
        return null;
      }
      const keys = Object.getOwnPropertyNames(value).sort();
      const result: Record<string, unknown> = {};
      for (const key of keys) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!isDataDescriptor(descriptor)) {
          return null;
        }
        result[key] = canonicalizeJSONSafeValue(descriptor.value, seen);
      }
      return result;
    } finally {
      seen.delete(value);
    }
  }
  return null;
}

function validateMLBInnerCandidateRecipe(
  recipe: unknown,
  path: string,
  issues: MLBInnerCandidateRecipeFingerprintIssue[],
): boolean {
  if (!isPlainObject(recipe)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'recipe must be a plain object');
    return false;
  }

  addKnownFieldIssues(
    recipe,
    new Set([
      'candidateRecipeId',
      'preprocessingPolicyId',
      'featurePolicyId',
      'modelFamilyId',
      'regularizationConfig',
      'optimizerConfig',
      'otherModelAffectingChoices',
      'complexityRank',
    ]),
    path,
    issues,
  );

  const rawId = ownDataProperty(recipe, 'candidateRecipeId', `${path}.candidateRecipeId`, issues);
  if (rawId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.candidateRecipeId`, 'candidateRecipeId is required');
    return false;
  }
  if (rawId.kind === 'accessor') {
    return false;
  }
  if (typeof rawId.value !== 'string' || rawId.value.trim() === '' || rawId.value !== rawId.value.trim()) {
    pushIssue(issues, 'INVALID_RECIPE_ID', `${path}.candidateRecipeId`, 'candidateRecipeId must be a non-empty trimmed string');
    return false;
  }

  const requiredStringFields = [
    { key: 'preprocessingPolicyId', code: 'EMPTY_POLICY_ID', message: 'preprocessingPolicyId must be a non-empty trimmed string' },
    { key: 'featurePolicyId', code: 'EMPTY_POLICY_ID', message: 'featurePolicyId must be a non-empty trimmed string' },
    { key: 'modelFamilyId', code: 'EMPTY_POLICY_ID', message: 'modelFamilyId must be a non-empty trimmed string' },
  ] as const;

  for (const field of requiredStringFields) {
    const raw = ownDataProperty(recipe, field.key, `${path}.${field.key}`, issues);
    if (raw.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', `${path}.${field.key}`, `${field.key} is required`);
      return false;
    }
    if (raw.kind === 'accessor') {
      return false;
    }
    if (typeof raw.value !== 'string' || raw.value.trim() === '' || raw.value !== raw.value.trim()) {
      pushIssue(issues, field.code, `${path}.${field.key}`, field.message);
      return false;
    }
  }

  const rawComplexity = ownDataProperty(recipe, 'complexityRank', `${path}.complexityRank`, issues);
  if (rawComplexity.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.complexityRank`, 'complexityRank is required');
    return false;
  }
  if (rawComplexity.kind === 'accessor') {
    return false;
  }
  if (typeof rawComplexity.value !== 'number' || !Number.isInteger(rawComplexity.value) || rawComplexity.value <= 0) {
    pushIssue(issues, 'INVALID_COMPLEXITY_RANK', `${path}.complexityRank`, 'complexityRank must be a positive integer');
    return false;
  }

  const configFields = [
    { key: 'regularizationConfig', path: `${path}.regularizationConfig` },
    { key: 'optimizerConfig', path: `${path}.optimizerConfig` },
    { key: 'otherModelAffectingChoices', path: `${path}.otherModelAffectingChoices` },
  ];

  for (const field of configFields) {
    const raw = ownDataProperty(recipe, field.key, field.path, issues);
    if (raw.kind === 'missing') {
      pushIssue(issues, 'MISSING_FIELD', field.path, `${field.key} is required`);
      return false;
    }
    if (raw.kind === 'accessor') {
      return false;
    }
    if (!isJSONSafeValue(raw.value, field.path, issues)) {
      return false;
    }
  }

  return true;
}

function validateMLBInnerDevelopmentRecipeBudget(
  budget: unknown,
  path: string,
  issues: MLBInnerDevelopmentRecipeBudgetIssue[],
): boolean {
  if (!isPlainObject(budget)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'budget must be a plain object');
    return false;
  }

  addKnownFieldIssues(
    budget,
    new Set([
      'contractVersion',
      'cycleId',
      'maxDistinctRecipes',
      'seenRecipeIds',
      'seenRecipeFingerprints',
      'seenComplexityRanks',
      'evaluationCount',
    ]),
    path,
    issues,
  );

  const contractVersion = ownDataProperty(budget, 'contractVersion', `${path}.contractVersion`, issues);
  if (contractVersion.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.contractVersion`, 'contractVersion is required');
    return false;
  }
  if (contractVersion.kind === 'data' && contractVersion.value !== MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION) {
    pushIssue(issues, 'INVALID_LITERAL', `${path}.contractVersion`, `contractVersion must be ${MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION}`);
    return false;
  }
  if (contractVersion.kind === 'accessor') {
    return false;
  }

  const cycleId = ownDataProperty(budget, 'cycleId', `${path}.cycleId`, issues);
  if (cycleId.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.cycleId`, 'cycleId is required');
    return false;
  }
  if (cycleId.kind === 'data' && cycleId.value !== MLB_INNER_DEVELOPMENT_CYCLE_ID) {
    pushIssue(issues, 'INVALID_LITERAL', `${path}.cycleId`, `cycleId must be ${MLB_INNER_DEVELOPMENT_CYCLE_ID}`);
    return false;
  }
  if (cycleId.kind === 'accessor') {
    return false;
  }

  const maxDistinctRecipes = ownDataProperty(budget, 'maxDistinctRecipes', `${path}.maxDistinctRecipes`, issues);
  if (maxDistinctRecipes.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.maxDistinctRecipes`, 'maxDistinctRecipes is required');
    return false;
  }
  if (maxDistinctRecipes.kind === 'accessor') {
    return false;
  }
  if (typeof maxDistinctRecipes.value !== 'number' || maxDistinctRecipes.value !== 12) {
    pushIssue(issues, 'INVALID_NUMBER', `${path}.maxDistinctRecipes`, 'maxDistinctRecipes must be 12');
    return false;
  }

  const seenRecipeIds = ownDataProperty(budget, 'seenRecipeIds', `${path}.seenRecipeIds`, issues);
  if (seenRecipeIds.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.seenRecipeIds`, 'seenRecipeIds is required');
    return false;
  }
  if (seenRecipeIds.kind === 'accessor') {
    return false;
  }
  if (!Array.isArray(seenRecipeIds.value)) {
    pushIssue(issues, 'INVALID_ARRAY', `${path}.seenRecipeIds`, 'seenRecipeIds must be an array');
    return false;
  }

  const seenRecipeFingerprints = ownDataProperty(budget, 'seenRecipeFingerprints', `${path}.seenRecipeFingerprints`, issues);
  if (seenRecipeFingerprints.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.seenRecipeFingerprints`, 'seenRecipeFingerprints is required');
    return false;
  }
  if (seenRecipeFingerprints.kind === 'accessor') {
    return false;
  }
  if (!Array.isArray(seenRecipeFingerprints.value)) {
    pushIssue(issues, 'INVALID_ARRAY', `${path}.seenRecipeFingerprints`, 'seenRecipeFingerprints must be an array');
    return false;
  }

  const seenComplexityRanks = ownDataProperty(budget, 'seenComplexityRanks', `${path}.seenComplexityRanks`, issues);
  if (seenComplexityRanks.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.seenComplexityRanks`, 'seenComplexityRanks is required');
    return false;
  }
  if (seenComplexityRanks.kind === 'accessor') {
    return false;
  }
  if (!Array.isArray(seenComplexityRanks.value)) {
    pushIssue(issues, 'INVALID_ARRAY', `${path}.seenComplexityRanks`, 'seenComplexityRanks must be an array');
    return false;
  }

  if (
    seenRecipeIds.value.length !== seenRecipeFingerprints.value.length ||
    seenRecipeIds.value.length !== seenComplexityRanks.value.length
  ) {
    pushIssue(issues, 'INVALID_ARRAY', `${path}.seen*`, 'seen arrays must have identical length');
    return false;
  }

  if (seenRecipeIds.value.length > 12) {
    pushIssue(issues, 'INVALID_NUMBER', `${path}.seenRecipeIds`, 'seen arrays length must not exceed 12');
    return false;
  }

  const idSet = new Set<string>();
  for (let i = 0; i < seenRecipeIds.value.length; i++) {
    const rawId = seenRecipeIds.value[i];
    if (typeof rawId !== 'string' || rawId.trim() === '' || rawId !== rawId.trim()) {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeIds[${i}]`, `seenRecipeIds[${i}] must be a non-empty trimmed string`);
      return false;
    }
    if (idSet.has(rawId)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeIds[${i}]`, `Duplicate recipe ID ${rawId}`);
      return false;
    }
    idSet.add(rawId);
  }

  const fingerprintSet = new Set<string>();
  for (let i = 0; i < seenRecipeFingerprints.value.length; i++) {
    const rawFingerprint = seenRecipeFingerprints.value[i];
    if (typeof rawFingerprint !== 'string') {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeFingerprints[${i}]`, 'fingerprint must be a string');
      return false;
    }
    if (!/^[0-9a-f]{64}$/.test(rawFingerprint)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeFingerprints[${i}]`, 'fingerprint must be lowercase 64-char hex');
      return false;
    }
    if (fingerprintSet.has(rawFingerprint)) {
      pushIssue(issues, 'INVALID_STRING', `${path}.seenRecipeFingerprints[${i}]`, `Duplicate fingerprint ${rawFingerprint}`);
      return false;
    }
    fingerprintSet.add(rawFingerprint);
  }

  for (let i = 0; i < seenComplexityRanks.value.length; i++) {
    const rawRank = seenComplexityRanks.value[i];
    if (typeof rawRank !== 'number' || !Number.isInteger(rawRank) || rawRank <= 0) {
      pushIssue(issues, 'INVALID_INTEGER', `${path}.seenComplexityRanks[${i}]`, 'complexityRank must be a positive integer');
      return false;
    }
  }

  const evaluationCount = ownDataProperty(budget, 'evaluationCount', `${path}.evaluationCount`, issues);
  if (evaluationCount.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', `${path}.evaluationCount`, 'evaluationCount is required');
    return false;
  }
  if (evaluationCount.kind === 'accessor') {
    return false;
  }
  if (typeof evaluationCount.value !== 'number' || !Number.isInteger(evaluationCount.value) || evaluationCount.value < 0) {
    pushIssue(issues, 'INVALID_INTEGER', `${path}.evaluationCount`, 'evaluationCount must be a non-negative integer');
    return false;
  }
  if (evaluationCount.value < seenRecipeIds.value.length) {
    pushIssue(issues, 'INVALID_NUMBER', `${path}.evaluationCount`, 'evaluationCount must be >= distinct recipe count');
    return false;
  }

  return true;
}

function serializeCanonicalRecipeFingerprintPayload(
  recipe: MLBInnerCandidateRecipe,
): string {
  const payload: Record<string, unknown> = {
    fingerprintContractVersion: MLB_INNER_CANDIDATE_RECIPE_FINGERPRINT_CONTRACT_VERSION,
    preprocessingPolicyId: recipe.preprocessingPolicyId,
    featurePolicyId: recipe.featurePolicyId,
    modelFamilyId: recipe.modelFamilyId,
    regularizationConfig: canonicalizeJSONSafeValue(recipe.regularizationConfig),
    optimizerConfig: canonicalizeJSONSafeValue(recipe.optimizerConfig),
    otherModelAffectingChoices: canonicalizeJSONSafeValue(recipe.otherModelAffectingChoices),
  };

  const sorted: Record<string, unknown> = {};
  const keys = Object.getOwnPropertyNames(payload).sort();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    sorted[key] = payload[key];
  }

  return JSON.stringify(sorted);
}

export type MLBInnerCandidateRecipeFingerprintResult =
  | Readonly<{ ok: true; fingerprint: string }>
  | Readonly<{ ok: false; issues: readonly MLBInnerCandidateRecipeFingerprintIssue[] }>;

export type MLBInnerDevelopmentRecipeBudgetResult =
  | Readonly<{ ok: true; value: MLBInnerDevelopmentRecipeBudget }>
  | Readonly<{ ok: false; issues: readonly MLBInnerDevelopmentRecipeBudgetIssue[] }>;

export function computeMLBInnerCandidateRecipeFingerprint(
  recipe: MLBInnerCandidateRecipe,
): MLBInnerCandidateRecipeFingerprintResult {
  const issues: MLBInnerCandidateRecipeFingerprintIssue[] = [];

  if (!validateMLBInnerCandidateRecipe(recipe, '$.recipe', issues)) {
    return { ok: false, issues: issues as readonly MLBInnerCandidateRecipeFingerprintIssue[] };
  }

  const canonical = serializeCanonicalRecipeFingerprintPayload(recipe);
  const fingerprint = createHash('sha256').update(canonical, 'utf8').digest('hex');

  return { ok: true, fingerprint };
}

export function recordInnerCandidateRecipeExecution(
  budget: MLBInnerDevelopmentRecipeBudget,
  candidateRecipe: MLBInnerCandidateRecipe,
): MLBInnerDevelopmentRecipeBudgetResult {
  const budgetIssues: MLBInnerDevelopmentRecipeBudgetIssue[] = [];

  if (!validateMLBInnerDevelopmentRecipeBudget(budget, '$.budget', budgetIssues)) {
    return { ok: false, issues: budgetIssues as readonly MLBInnerDevelopmentRecipeBudgetIssue[] };
  }

  const recipeIssues: MLBInnerCandidateRecipeFingerprintIssue[] = [];
  if (!validateMLBInnerCandidateRecipe(candidateRecipe, '$.candidateRecipe', recipeIssues)) {
    return { ok: false, issues: recipeIssues as readonly MLBInnerDevelopmentRecipeBudgetIssue[] };
  }

  const fingerprintResult = computeMLBInnerCandidateRecipeFingerprint(candidateRecipe);
  if (!fingerprintResult.ok) {
    return { ok: false, issues: recipeIssues as readonly MLBInnerDevelopmentRecipeBudgetIssue[] };
  }
  const fingerprint = fingerprintResult.fingerprint;

  const existingIdIndex = budget.seenRecipeIds.indexOf(candidateRecipe.candidateRecipeId);
  const existingFingerprintIndex = budget.seenRecipeFingerprints.indexOf(fingerprint);

  if (existingIdIndex !== -1 && existingFingerprintIndex !== -1) {
    if (budget.seenComplexityRanks[existingIdIndex] !== candidateRecipe.complexityRank) {
      return {
        ok: false,
        issues: [
          {
            code: 'COMPLEXITY_RANK_MISMATCH',
            path: '$.candidateRecipe.complexityRank',
            message: `Registered complexityRank ${budget.seenComplexityRanks[existingIdIndex]} differs from requested ${candidateRecipe.complexityRank}`,
          } as MLBInnerDevelopmentRecipeBudgetIssue,
        ],
      };
    }
    const newEvaluationCount = budget.evaluationCount + 1;
    return {
      ok: true,
      value: {
        contractVersion: MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION,
        cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
        maxDistinctRecipes: 12,
        seenRecipeIds: budget.seenRecipeIds,
        seenRecipeFingerprints: budget.seenRecipeFingerprints,
        seenComplexityRanks: budget.seenComplexityRanks,
        evaluationCount: newEvaluationCount,
      },
    };
  }

  if (existingIdIndex !== -1 && existingFingerprintIndex === -1) {
    return {
      ok: false,
      issues: [
        {
          code: 'IDENTITY_MUTATION_CONFLICT',
          path: '$.candidateRecipe',
          message: `candidateRecipeId ${candidateRecipe.candidateRecipeId} is registered with a different fingerprint`,
        } as MLBInnerDevelopmentRecipeBudgetIssue,
      ],
    };
  }

  if (existingIdIndex === -1 && existingFingerprintIndex !== -1) {
    const registeredId = budget.seenRecipeIds[existingFingerprintIndex];
    return {
      ok: false,
      issues: [
        {
          code: 'IDENTITY_ALIAS_CONFLICT',
          path: '$.candidateRecipe.candidateRecipeId',
          message: `fingerprint already registered under candidateRecipeId ${registeredId}`,
        } as MLBInnerDevelopmentRecipeBudgetIssue,
      ],
    };
  }

  if (budget.seenRecipeIds.length >= 12) {
    return {
      ok: false,
      issues: [
        {
          code: 'BUDGET_EXHAUSTED',
          path: '$.budget.seenRecipeIds',
          message: 'Maximum of 12 distinct recipes reached',
        } as MLBInnerDevelopmentRecipeBudgetIssue,
      ],
    };
  }

  const newSeenRecipeIds = [...budget.seenRecipeIds, candidateRecipe.candidateRecipeId];
  const newSeenRecipeFingerprints = [...budget.seenRecipeFingerprints, fingerprint];
  const newSeenComplexityRanks = [...budget.seenComplexityRanks, candidateRecipe.complexityRank];
  const newEvaluationCount = budget.evaluationCount + 1;

  return {
    ok: true,
    value: {
      contractVersion: MLB_INNER_DEVELOPMENT_RECIPE_BUDGET_CONTRACT_VERSION,
      cycleId: MLB_INNER_DEVELOPMENT_CYCLE_ID,
      maxDistinctRecipes: 12,
      seenRecipeIds: newSeenRecipeIds,
      seenRecipeFingerprints: newSeenRecipeFingerprints,
      seenComplexityRanks: newSeenComplexityRanks,
      evaluationCount: newEvaluationCount,
    },
  };
}

export function rankInnerEligibleCandidates(
  budget: MLBInnerDevelopmentRecipeBudget,
  candidates: readonly MLBInnerRankableCandidateInput[],
): MLBInnerCandidateRankResult {
  const budgetIssues: MLBInnerDevelopmentRecipeBudgetIssue[] = [];
  if (!validateMLBInnerDevelopmentRecipeBudget(budget, '$.budget', budgetIssues)) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_BUDGET',
          path: '$.budget',
          message: budgetIssues[0]?.message ?? 'Invalid budget',
        } as MLBInnerCandidateRankIssue,
      ],
    };
  }

  if (!Array.isArray(candidates)) {
    return {
      ok: false,
      issues: [
        {
          code: 'INVALID_RECIPE',
          path: '$.candidates',
          message: 'candidates must be an array',
        } as MLBInnerCandidateRankIssue,
      ],
    };
  }

  const seenCandidateRecipeIds = new Set<string>();
  const eligibleCandidates: Array<{
    candidateRecipeId: string;
    recipeFingerprint: string;
    aggregateLogLoss: number;
    aggregateBrierScore: number;
    complexityRank: number;
  }> = [];

  for (let c = 0; c < candidates.length; c++) {
    const candidatePath = `$.candidates[${c}]`;

    const elementDescriptor = Object.getOwnPropertyDescriptor(candidates, c);
    if (!elementDescriptor || !isDataDescriptor(elementDescriptor)) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_RECIPE',
            path: candidatePath,
            message: 'candidate must be a data property',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    const candidate = elementDescriptor.value;

    if (!isPlainObject(candidate)) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_RECIPE',
            path: candidatePath,
            message: 'candidate must be a plain object',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    const recipeDescriptor = Object.getOwnPropertyDescriptor(candidate, 'recipe');
    if (!recipeDescriptor || !isDataDescriptor(recipeDescriptor)) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_RECIPE',
            path: `${candidatePath}.recipe`,
            message: 'recipe must be a data property',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }
    const rawRecipe = recipeDescriptor.value;

    const foldResultsDescriptor = Object.getOwnPropertyDescriptor(candidate, 'foldResults');
    if (!foldResultsDescriptor || !isDataDescriptor(foldResultsDescriptor)) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_FOLD_RESULTS',
            path: `${candidatePath}.foldResults`,
            message: 'foldResults must be a data property',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }
    const rawFoldResults = foldResultsDescriptor.value;

    if (!isPlainObject(rawRecipe)) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_RECIPE',
            path: `${candidatePath}.recipe`,
            message: 'recipe must be a plain object',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    const recipe = rawRecipe as MLBInnerCandidateRecipe;
    const recipeIssues: MLBInnerCandidateRecipeFingerprintIssue[] = [];
    if (!validateMLBInnerCandidateRecipe(recipe, `${candidatePath}.recipe`, recipeIssues)) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_RECIPE',
            path: `${candidatePath}.recipe`,
            message: recipeIssues[0]?.message ?? 'Invalid recipe',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    const fingerprintResult = computeMLBInnerCandidateRecipeFingerprint(recipe);
    if (!fingerprintResult.ok) {
      return {
        ok: false,
        issues: [
          {
            code: 'RECIPE_FINGERPRINT_MISMATCH',
            path: `${candidatePath}.recipe`,
            message: fingerprintResult.issues[0]?.message ?? 'Fingerprint computation failed',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }
    const recipeFingerprint = fingerprintResult.fingerprint;

    const existingIdIndex = budget.seenRecipeIds.indexOf(recipe.candidateRecipeId);
    if (existingIdIndex === -1) {
      return {
        ok: false,
        issues: [
          {
            code: 'UNREGISTERED_RECIPE',
            path: `${candidatePath}.recipe.candidateRecipeId`,
            message: `candidateRecipeId ${recipe.candidateRecipeId} is not registered in the budget`,
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    const registeredFingerprint = budget.seenRecipeFingerprints[existingIdIndex];
    if (registeredFingerprint !== recipeFingerprint) {
      return {
        ok: false,
        issues: [
          {
            code: 'RECIPE_FINGERPRINT_MISMATCH',
            path: `${candidatePath}.recipe`,
            message: `Registered fingerprint differs from computed fingerprint for ${recipe.candidateRecipeId}`,
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    const registeredComplexityRank = budget.seenComplexityRanks[existingIdIndex];
    if (registeredComplexityRank !== recipe.complexityRank) {
      return {
        ok: false,
        issues: [
          {
            code: 'COMPLEXITY_RANK_MISMATCH',
            path: `${candidatePath}.recipe.complexityRank`,
            message: `Registered complexityRank ${registeredComplexityRank} differs from recipe complexityRank ${recipe.complexityRank}`,
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    if (!Array.isArray(rawFoldResults)) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_FOLD_RESULTS',
            path: `${candidatePath}.foldResults`,
            message: 'foldResults must be an array',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    const aggregateResult = evaluateMLBTrainOnlyInnerCandidate(rawFoldResults);
    if (!aggregateResult.ok) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_FOLD_RESULTS',
            path: `${candidatePath}.foldResults`,
            message: aggregateResult.issues[0]?.message ?? 'Invalid fold results',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    if (aggregateResult.value.candidateRecipeId !== recipe.candidateRecipeId) {
      return {
        ok: false,
        issues: [
          {
            code: 'RECIPE_FOLD_ID_MISMATCH',
            path: `${candidatePath}.foldResults`,
            message: `Fold results candidateRecipeId ${aggregateResult.value.candidateRecipeId} does not match recipe candidateRecipeId ${recipe.candidateRecipeId}`,
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    const gateResult = evaluateMLBTrainOnlyInnerCandidateGate(rawFoldResults);
    if (!gateResult.ok) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_FOLD_RESULTS',
            path: `${candidatePath}.foldResults`,
            message: gateResult.issues[0]?.message ?? 'Gate evaluation failed',
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }

    if (seenCandidateRecipeIds.has(recipe.candidateRecipeId)) {
      return {
        ok: false,
        issues: [
          {
            code: 'DUPLICATE_CANDIDATE_ENTRY',
            path: `${candidatePath}.recipe.candidateRecipeId`,
            message: `Duplicate candidateRecipeId ${recipe.candidateRecipeId} in ranking input`,
          } as MLBInnerCandidateRankIssue,
        ],
      };
    }
    seenCandidateRecipeIds.add(recipe.candidateRecipeId);

    if (gateResult.value.eligibility === 'INNER_ELIGIBLE') {
      eligibleCandidates.push({
        candidateRecipeId: recipe.candidateRecipeId,
        recipeFingerprint: recipeFingerprint,
        aggregateLogLoss: aggregateResult.value.aggregateCandidateLogLoss,
        aggregateBrierScore: aggregateResult.value.aggregateCandidateBrierScore,
        complexityRank: recipe.complexityRank,
      });
    }
  }

  eligibleCandidates.sort((a, b) => {
    if (a.aggregateLogLoss !== b.aggregateLogLoss) {
      return a.aggregateLogLoss < b.aggregateLogLoss ? -1 : 1;
    }
    if (a.aggregateBrierScore !== b.aggregateBrierScore) {
      return a.aggregateBrierScore < b.aggregateBrierScore ? -1 : 1;
    }
    if (a.complexityRank !== b.complexityRank) {
      return a.complexityRank < b.complexityRank ? -1 : 1;
    }
    if (a.candidateRecipeId !== b.candidateRecipeId) {
      return a.candidateRecipeId < b.candidateRecipeId ? -1 : 1;
    }
    return 0;
  });

  const ranked: MLBInnerCandidateRank[] = eligibleCandidates.map((c, index) => ({
    rank: index + 1,
    candidateRecipeId: c.candidateRecipeId,
    recipeFingerprint: c.recipeFingerprint,
    aggregateLogLoss: c.aggregateLogLoss,
    aggregateBrierScore: c.aggregateBrierScore,
    complexityRank: c.complexityRank,
  }));

  return { ok: true, value: ranked };
}
