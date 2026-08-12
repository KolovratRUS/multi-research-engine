import { assertNoOddsContamination } from '../firewall/odds-contamination-guard';
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

type EvaluatorIssue = MLBTrainOnlyInnerRowCollectionIssue | MLBTrainOnlyInnerValidationFoldsIssue;

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
