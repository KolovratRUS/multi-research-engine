export const MLB_TRAIN_ONLY_INNER_FOLD_PLAN_CONTRACT_VERSION =
  'mlb-train-only-inner-fold-plan-v1' as const;

export type MLBFoldDefinition = Readonly<{
  foldId: string;
  innerTrainStartDate: string;
  innerTrainEndDate: string;
  innerValidationStartDate: string;
  innerValidationEndDate: string;
  expectedTrainRowCount: number;
  expectedValidationRowCount: number;
  expectedTrainHomeWinCount: number;
  expectedTrainAwayWinCount: number;
  expectedValidationHomeWinCount: number;
  expectedValidationAwayWinCount: number;
}>;

export type MLBTrainOnlyInnerFoldPlan = Readonly<{
  contractVersion: typeof MLB_TRAIN_ONLY_INNER_FOLD_PLAN_CONTRACT_VERSION;
  sport: 'MLB';
  target: 'OFFICIAL_FINAL_GAME_WINNER';
  expectedOuterTrainRowCount: number;
  folds: readonly MLBFoldDefinition[];
}>;

export type MLBTrainOnlyInnerFoldPlanIssue = Readonly<{
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
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
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
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
  code: MLBTrainOnlyInnerFoldPlanIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function pushUniquePathCode(
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
  next: MLBTrainOnlyInnerFoldPlanIssue,
): void {
  const exists = issues.some((item) => item.path === next.path && item.code === next.code);
  if (!exists) {
    issues.push(next);
  }
}

function sortIssues(
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
): MLBTrainOnlyInnerFoldPlanIssue[] {
  return issues
    .slice()
    .sort((a, b) => {
      const pathDiff = a.path < b.path ? -1 : a.path === b.path ? 0 : 1;
      if (pathDiff !== 0) return pathDiff;
      const codeDiff = a.code < b.code ? -1 : a.code === b.code ? 0 : 1;
      return codeDiff;
    })
    .filter((item, index, array) =>
      index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
    );
}

function addKnownFieldIssues(
  record: Record<string, unknown>,
  known: Set<string>,
  path: string,
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
): void {
  const names = Object.getOwnPropertyNames(record);
  for (const key of names) {
    if (!known.has(key)) {
      pushIssue(issues, 'UNKNOWN_FIELD', `${path}.${key}`, `Unknown field: ${key}`);
    }
  }
  const symbols = Object.getOwnPropertySymbols(record);
  for (const symbol of symbols) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `${path}[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }
}

const PROHIBITED_PLAN_FIELDS = new Set([
  'model',
  'candidate',
  'recipe',
  'probability',
  'prediction',
  'metric',
  'baseline',
  'outerValidation',
  'test',
  'validationRows',
  'trainRows',
  'odds',
  'sportsbook',
  'moneyline',
  'price',
  'market',
  'edge',
  'value',
  'clv',
  'stake',
  'grading',
]);

const KNOWN_PLAN_ROOT_FIELDS = new Set([
  'contractVersion',
  'sport',
  'target',
  'expectedOuterTrainRowCount',
  'folds',
]);

const KNOWN_FOLD_FIELDS = new Set([
  'foldId',
  'innerTrainStartDate',
  'innerTrainEndDate',
  'innerValidationStartDate',
  'innerValidationEndDate',
  'expectedTrainRowCount',
  'expectedValidationRowCount',
  'expectedTrainHomeWinCount',
  'expectedTrainAwayWinCount',
  'expectedValidationHomeWinCount',
  'expectedValidationAwayWinCount',
]);

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
  if (month < 1 || month > 12 || day < 1) {
    return false;
  }
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const maxDay = leap ? 29 : daysInMonth[month - 1];
  return day <= maxDay;
}

function dateFrom(iso: string): Date {
  return new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))));
}

function validateIdentifier(
  value: unknown,
  path: string,
  label: string,
): string | MLBTrainOnlyInnerFoldPlanIssue {
  if (!isStrictNonEmptyTrimmedString(value)) {
    return { code: 'INVALID_STRING', path, message: `${label} must be a valid identifier` };
  }
  return value;
}

function validatePositiveInteger(
  value: unknown,
  path: string,
  label: string,
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    pushIssue(issues, 'INVALID_INTEGER', path, `${label} must be a positive integer`);
    return undefined;
  }
  return value;
}

function validateNonNegativeInteger(
  value: unknown,
  path: string,
  label: string,
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    pushIssue(issues, 'INVALID_INTEGER', path, `${label} must be a non-negative integer`);
    return undefined;
  }
  return value;
}

function validateFiniteNumber(
  value: unknown,
  path: string,
  label: string,
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    pushIssue(issues, 'INVALID_NUMBER', path, `${label} must be finite`);
    return undefined;
  }
  return value;
}

function validateDateField(
  value: unknown,
  path: string,
  label: string,
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
): string | undefined {
  if (!isStrictNonEmptyTrimmedString(value)) {
    pushIssue(issues, 'INVALID_DATE', path, `${label} must be a valid YYYY-MM-DD date string`);
    return undefined;
  }
  if (!validateGregorianDate(value)) {
    pushIssue(issues, 'INVALID_DATE', path, `${label} must be a valid Gregorian date`);
    return undefined;
  }
  return value;
}

function readDescriptorSafeArray(
  value: unknown,
  path: string,
  issues: MLBTrainOnlyInnerFoldPlanIssue[],
): unknown[] | null {
  if (!Array.isArray(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', path, 'Expected array');
    return null;
  }

  const ownNames = Object.getOwnPropertyNames(value);
  for (const key of ownNames) {
    if (key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (
        !Number.isSafeInteger(index) ||
        index < 0 ||
        String(index) !== key
      ) {
        pushIssue(
          issues,
          'INVALID_JSON_VALUE',
          `${path}[${key}]`,
          'Array contains non-canonical numeric property',
        );
        return null;
      }
      if (!descriptor || !isDataDescriptor(descriptor)) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${key}]`, 'Array contains accessor property');
        return null;
      }
    } else {
      if (descriptor && !isDataDescriptor(descriptor)) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${key}]`, 'Array contains accessor property');
        return null;
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${key}]`, 'Array contains additional property');
        return null;
      }
    }
  }

  const ownSymbols = Object.getOwnPropertySymbols(value);
  for (const symbol of ownSymbols) {
    pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${String(symbol)}]`, 'Array contains symbol property');
    return null;
  }

  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, 'length');
  if (
    !lengthDescriptor ||
    !isDataDescriptor(lengthDescriptor) ||
    typeof lengthDescriptor.value !== 'number' ||
    !Number.isSafeInteger(lengthDescriptor.value) ||
    lengthDescriptor.value < 0
  ) {
    pushIssue(issues, 'INVALID_ARRAY', path, 'Array length must be a non-negative safe integer');
    return null;
  }

  const expectedLength = lengthDescriptor.value;
  const seenIndices = new Array<boolean>(expectedLength).fill(false);

  for (const key of ownNames) {
    if (key === 'length') continue;
    if (/^\d+$/.test(key)) {
      const index = Number(key);
      if (index >= expectedLength || String(index) !== key) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `${path}[${key}]`, 'Array contains non-canonical numeric property');
        return null;
      }
      seenIndices[index] = true;
    }
  }

  for (let i = 0; i < expectedLength; i++) {
    if (!seenIndices[i]) {
      pushIssue(issues, 'INVALID_ARRAY', path, 'Array is sparse');
      return null;
    }
  }

  return Array.from(value);
}

const FROZEN_PLAN: MLBTrainOnlyInnerFoldPlan = {
  contractVersion: MLB_TRAIN_ONLY_INNER_FOLD_PLAN_CONTRACT_VERSION,
  sport: 'MLB',
  target: 'OFFICIAL_FINAL_GAME_WINNER',
  expectedOuterTrainRowCount: 301,
  folds: [
    {
      foldId: 'FOLD_1',
      innerTrainStartDate: '2026-04-01',
      innerTrainEndDate: '2026-04-07',
      innerValidationStartDate: '2026-04-08',
      innerValidationEndDate: '2026-04-11',
      expectedTrainRowCount: 91,
      expectedValidationRowCount: 51,
      expectedTrainHomeWinCount: 49,
      expectedTrainAwayWinCount: 42,
      expectedValidationHomeWinCount: 29,
      expectedValidationAwayWinCount: 22,
    },
    {
      foldId: 'FOLD_2',
      innerTrainStartDate: '2026-04-01',
      innerTrainEndDate: '2026-04-11',
      innerValidationStartDate: '2026-04-12',
      innerValidationEndDate: '2026-04-15',
      expectedTrainRowCount: 142,
      expectedValidationRowCount: 55,
      expectedTrainHomeWinCount: 78,
      expectedTrainAwayWinCount: 64,
      expectedValidationHomeWinCount: 34,
      expectedValidationAwayWinCount: 21,
    },
    {
      foldId: 'FOLD_3',
      innerTrainStartDate: '2026-04-01',
      innerTrainEndDate: '2026-04-15',
      innerValidationStartDate: '2026-04-16',
      innerValidationEndDate: '2026-04-19',
      expectedTrainRowCount: 197,
      expectedValidationRowCount: 55,
      expectedTrainHomeWinCount: 112,
      expectedTrainAwayWinCount: 85,
      expectedValidationHomeWinCount: 25,
      expectedValidationAwayWinCount: 30,
    },
    {
      foldId: 'FOLD_4',
      innerTrainStartDate: '2026-04-01',
      innerTrainEndDate: '2026-04-19',
      innerValidationStartDate: '2026-04-20',
      innerValidationEndDate: '2026-04-23',
      expectedTrainRowCount: 252,
      expectedValidationRowCount: 49,
      expectedTrainHomeWinCount: 137,
      expectedTrainAwayWinCount: 115,
      expectedValidationHomeWinCount: 23,
      expectedValidationAwayWinCount: 26,
    },
  ],
};

export const MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN = FROZEN_PLAN;

export function validateMLBTrainOnlyInnerFoldPlan(
  value: unknown,
):
  | Readonly<{ ok: true; value: MLBTrainOnlyInnerFoldPlan }>
  | Readonly<{ ok: false; issues: readonly MLBTrainOnlyInnerFoldPlanIssue[] }> {
  const issues: MLBTrainOnlyInnerFoldPlanIssue[] = [];

  if (!isPlainObject(value)) {
    pushIssue(issues, 'NOT_PLAIN_OBJECT', '$', 'Expected plain object');
    return { ok: false, issues: sortIssues(issues) };
  }

  const root = value as Record<string, unknown>;

  for (const key of Object.getOwnPropertyNames(root)) {
    if (PROHIBITED_PLAN_FIELDS.has(key)) {
      const descriptor = Object.getOwnPropertyDescriptor(root, key);
      if (descriptor && isDataDescriptor(descriptor)) {
        pushIssue(issues, 'PROHIBITED_CONCEPT', `$.${key}`, `Prohibited field: ${key}`);
      } else if (descriptor) {
        pushIssue(issues, 'INVALID_JSON_VALUE', `$.${key}`, 'Prohibited accessor property');
      }
    }
  }

  const symbols = Object.getOwnPropertySymbols(root);
  for (const symbol of symbols) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$[${String(symbol)}]`,
      `Unknown symbol property: ${symbol.description ?? symbol.toString()}`,
    );
  }

  addKnownFieldIssues(root, KNOWN_PLAN_ROOT_FIELDS, '$', issues);

  const contractVersionResult = ownDataProperty(root, 'contractVersion', '$.contractVersion', issues);
  let contractVersionOk = false;
  if (contractVersionResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.contractVersion', 'contractVersion is required');
  } else if (contractVersionResult.kind === 'data') {
    if (contractVersionResult.value !== MLB_TRAIN_ONLY_INNER_FOLD_PLAN_CONTRACT_VERSION) {
      pushIssue(
        issues,
        'INVALID_LITERAL',
        '$.contractVersion',
        `contractVersion must be ${MLB_TRAIN_ONLY_INNER_FOLD_PLAN_CONTRACT_VERSION}`,
      );
    } else {
      contractVersionOk = true;
    }
  }

  const sportResult = ownDataProperty(root, 'sport', '$.sport', issues);
  let sportOk = false;
  if (sportResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.sport', 'sport is required');
  } else if (sportResult.kind === 'data') {
    if (sportResult.value !== 'MLB') {
      pushIssue(issues, 'INVALID_LITERAL', '$.sport', 'sport must be MLB');
    } else {
      sportOk = true;
    }
  }

  const targetResult = ownDataProperty(root, 'target', '$.target', issues);
  let targetOk = false;
  if (targetResult.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', '$.target', 'target is required');
  } else if (targetResult.kind === 'data') {
    if (targetResult.value !== 'OFFICIAL_FINAL_GAME_WINNER') {
      pushIssue(issues, 'INVALID_LITERAL', '$.target', 'target must be OFFICIAL_FINAL_GAME_WINNER');
    } else {
      targetOk = true;
    }
  }

  const expectedOuterTrainRowCountResult = ownDataProperty(
    root,
    'expectedOuterTrainRowCount',
    '$.expectedOuterTrainRowCount',
    issues,
  );
  let expectedOuterTrainRowCount: number | undefined;
  if (expectedOuterTrainRowCountResult.kind === 'missing') {
    pushIssue(
      issues,
      'MISSING_FIELD',
      '$.expectedOuterTrainRowCount',
      'expectedOuterTrainRowCount is required',
    );
  } else if (expectedOuterTrainRowCountResult.kind === 'data') {
    expectedOuterTrainRowCount = validatePositiveInteger(
      expectedOuterTrainRowCountResult.value,
      '$.expectedOuterTrainRowCount',
      'expectedOuterTrainRowCount',
      issues,
    );
    if (
      expectedOuterTrainRowCount !== undefined &&
      expectedOuterTrainRowCount !== 301
    ) {
      pushIssue(
        issues,
        'COUNT_MISMATCH',
        '$.expectedOuterTrainRowCount',
        `expectedOuterTrainRowCount must be 301 for the frozen plan`,
      );
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

      const seenFoldIds = new Set<string>();
      const canonicalFolds = FROZEN_PLAN.folds;
      let canonicalIndex = 0;

      for (let i = 0; i < validatedFolds.length; i++) {
        const foldPath = `$.folds[${i}]`;
        const fold = validatedFolds[i];

        if (!isPlainObject(fold)) {
          pushIssue(issues, 'NOT_PLAIN_OBJECT', foldPath, 'Fold must be a plain object');
          continue;
        }

        const foldRoot = fold as Record<string, unknown>;
        addKnownFieldIssues(foldRoot, KNOWN_FOLD_FIELDS, foldPath, issues);

        const foldIdResult = ownDataProperty(foldRoot, 'foldId', `${foldPath}.foldId`, issues);
        let foldId: string | undefined;
        if (foldIdResult.kind === 'missing') {
          pushIssue(issues, 'MISSING_FIELD', `${foldPath}.foldId`, 'foldId is required');
        } else if (foldIdResult.kind === 'data') {
          const id = validateIdentifier(foldIdResult.value, `${foldPath}.foldId`, 'foldId');
          if (typeof id === 'string') {
            foldId = id;
            if (seenFoldIds.has(foldId)) {
              pushIssue(issues, 'DUPLICATE_ID', `${foldPath}.foldId`, `Duplicate foldId: ${foldId}`);
            } else {
              seenFoldIds.add(foldId);
            }
          } else {
            issues.push(id);
          }
        }

        const expectedFold = canonicalFolds[canonicalIndex];
        if (foldId && expectedFold && foldId !== expectedFold.foldId) {
          pushIssue(
            issues,
            'NON_CANONICAL_ORDER',
            `${foldPath}.foldId`,
            `Fold order mismatch: expected ${expectedFold.foldId} at index ${i}`,
          );
        }

        const trainStartResult = ownDataProperty(
          foldRoot,
          'innerTrainStartDate',
          `${foldPath}.innerTrainStartDate`,
          issues,
        );
        const trainEndResult = ownDataProperty(
          foldRoot,
          'innerTrainEndDate',
          `${foldPath}.innerTrainEndDate`,
          issues,
        );
        const validationStartResult = ownDataProperty(
          foldRoot,
          'innerValidationStartDate',
          `${foldPath}.innerValidationStartDate`,
          issues,
        );
        const validationEndResult = ownDataProperty(
          foldRoot,
          'innerValidationEndDate',
          `${foldPath}.innerValidationEndDate`,
          issues,
        );

        let trainStart: string | undefined;
        let trainEnd: string | undefined;
        let validationStart: string | undefined;
        let validationEnd: string | undefined;

        if (trainStartResult.kind === 'data') {
          trainStart = validateDateField(trainStartResult.value, `${foldPath}.innerTrainStartDate`, 'innerTrainStartDate', issues);
        }
        if (trainEndResult.kind === 'data') {
          trainEnd = validateDateField(trainEndResult.value, `${foldPath}.innerTrainEndDate`, 'innerTrainEndDate', issues);
        }
        if (validationStartResult.kind === 'data') {
          validationStart = validateDateField(validationStartResult.value, `${foldPath}.innerValidationStartDate`, 'innerValidationStartDate', issues);
        }
        if (validationEndResult.kind === 'data') {
          validationEnd = validateDateField(validationEndResult.value, `${foldPath}.innerValidationEndDate`, 'innerValidationEndDate', issues);
        }

        if (trainStart && trainEnd && validationStart && validationEnd) {
          const trainStartDate = dateFrom(trainStart);
          const trainEndDate = dateFrom(trainEnd);
          const validationStartDate = dateFrom(validationStart);
          const validationEndDate = dateFrom(validationEnd);

          if (trainStartDate > trainEndDate) {
            pushIssue(
              issues,
              'DATE_ORDER_VIOLATION',
              `${foldPath}.innerTrainEndDate`,
              'innerTrainStartDate must be <= innerTrainEndDate',
            );
          }

          if (validationStartDate > validationEndDate) {
            pushIssue(
              issues,
              'DATE_ORDER_VIOLATION',
              `${foldPath}.innerValidationEndDate`,
              'innerValidationStartDate must be <= innerValidationEndDate',
            );
          }

          if (trainEndDate >= validationStartDate) {
            pushIssue(
              issues,
              'DATE_ORDER_VIOLATION',
              `${foldPath}.innerValidationStartDate`,
              'innerTrainEndDate must be strictly before innerValidationStartDate',
            );
          }

          if (trainStart !== '2026-04-01') {
            pushIssue(
              issues,
              'DATE_ORDER_VIOLATION',
              `${foldPath}.innerTrainStartDate`,
              'innerTrainStartDate must be 2026-04-01 for the frozen plan',
            );
          }

          if (expectedFold) {
            if (
              trainStart !== expectedFold.innerTrainStartDate ||
              trainEnd !== expectedFold.innerTrainEndDate ||
              validationStart !== expectedFold.innerValidationStartDate ||
              validationEnd !== expectedFold.innerValidationEndDate
            ) {
              pushIssue(
                issues,
                'DATE_ORDER_VIOLATION',
                foldPath,
                `Fold dates do not match frozen plan for ${expectedFold.foldId}`,
              );
            }
          }
        }

        const expectedTrainRowCountResult = ownDataProperty(
          foldRoot,
          'expectedTrainRowCount',
          `${foldPath}.expectedTrainRowCount`,
          issues,
        );
        const expectedValidationRowCountResult = ownDataProperty(
          foldRoot,
          'expectedValidationRowCount',
          `${foldPath}.expectedValidationRowCount`,
          issues,
        );
        const expectedTrainHomeWinCountResult = ownDataProperty(
          foldRoot,
          'expectedTrainHomeWinCount',
          `${foldPath}.expectedTrainHomeWinCount`,
          issues,
        );
        const expectedTrainAwayWinCountResult = ownDataProperty(
          foldRoot,
          'expectedTrainAwayWinCount',
          `${foldPath}.expectedTrainAwayWinCount`,
          issues,
        );
        const expectedValidationHomeWinCountResult = ownDataProperty(
          foldRoot,
          'expectedValidationHomeWinCount',
          `${foldPath}.expectedValidationHomeWinCount`,
          issues,
        );
        const expectedValidationAwayWinCountResult = ownDataProperty(
          foldRoot,
          'expectedValidationAwayWinCount',
          `${foldPath}.expectedValidationAwayWinCount`,
          issues,
        );

        let expectedTrainRowCount: number | undefined;
        let expectedValidationRowCount: number | undefined;
        let expectedTrainHomeWinCount: number | undefined;
        let expectedTrainAwayWinCount: number | undefined;
        let expectedValidationHomeWinCount: number | undefined;
        let expectedValidationAwayWinCount: number | undefined;

        if (expectedTrainRowCountResult.kind === 'data') {
          expectedTrainRowCount = validatePositiveInteger(expectedTrainRowCountResult.value, `${foldPath}.expectedTrainRowCount`, 'expectedTrainRowCount', issues);
        }
        if (expectedValidationRowCountResult.kind === 'data') {
          expectedValidationRowCount = validatePositiveInteger(expectedValidationRowCountResult.value, `${foldPath}.expectedValidationRowCount`, 'expectedValidationRowCount', issues);
        }
        if (expectedTrainHomeWinCountResult.kind === 'data') {
          expectedTrainHomeWinCount = validateNonNegativeInteger(expectedTrainHomeWinCountResult.value, `${foldPath}.expectedTrainHomeWinCount`, 'expectedTrainHomeWinCount', issues);
        }
        if (expectedTrainAwayWinCountResult.kind === 'data') {
          expectedTrainAwayWinCount = validateNonNegativeInteger(expectedTrainAwayWinCountResult.value, `${foldPath}.expectedTrainAwayWinCount`, 'expectedTrainAwayWinCount', issues);
        }
        if (expectedValidationHomeWinCountResult.kind === 'data') {
          expectedValidationHomeWinCount = validateNonNegativeInteger(expectedValidationHomeWinCountResult.value, `${foldPath}.expectedValidationHomeWinCount`, 'expectedValidationHomeWinCount', issues);
        }
        if (expectedValidationAwayWinCountResult.kind === 'data') {
          expectedValidationAwayWinCount = validateNonNegativeInteger(expectedValidationAwayWinCountResult.value, `${foldPath}.expectedValidationAwayWinCount`, 'expectedValidationAwayWinCount', issues);
        }

        if (
          expectedTrainRowCount !== undefined &&
          expectedValidationRowCount !== undefined &&
          expectedTrainHomeWinCount !== undefined &&
          expectedTrainAwayWinCount !== undefined &&
          expectedValidationHomeWinCount !== undefined &&
          expectedValidationAwayWinCount !== undefined
        ) {
          if (expectedTrainHomeWinCount + expectedTrainAwayWinCount !== expectedTrainRowCount) {
            pushIssue(
              issues,
              'COUNT_MISMATCH',
              foldPath,
              'expectedTrainHomeWinCount + expectedTrainAwayWinCount must equal expectedTrainRowCount',
            );
          }
          if (expectedValidationHomeWinCount + expectedValidationAwayWinCount !== expectedValidationRowCount) {
            pushIssue(
              issues,
              'COUNT_MISMATCH',
              foldPath,
              'expectedValidationHomeWinCount + expectedValidationAwayWinCount must equal expectedValidationRowCount',
            );
          }
          if (expectedTrainHomeWinCount === 0 || expectedTrainAwayWinCount === 0) {
            pushIssue(issues, 'CLASS_DEGENERATE', foldPath, 'Train fold must contain both classes');
          }
          if (expectedValidationHomeWinCount === 0 || expectedValidationAwayWinCount === 0) {
            pushIssue(issues, 'CLASS_DEGENERATE', foldPath, 'Validation fold must contain both classes');
          }

          if (expectedFold) {
            if (
              expectedTrainRowCount !== expectedFold.expectedTrainRowCount ||
              expectedValidationRowCount !== expectedFold.expectedValidationRowCount ||
              expectedTrainHomeWinCount !== expectedFold.expectedTrainHomeWinCount ||
              expectedTrainAwayWinCount !== expectedFold.expectedTrainAwayWinCount ||
              expectedValidationHomeWinCount !== expectedFold.expectedValidationHomeWinCount ||
              expectedValidationAwayWinCount !== expectedFold.expectedValidationAwayWinCount
            ) {
              pushIssue(
                issues,
                'COUNT_MISMATCH',
                foldPath,
                `Counts do not match frozen plan for ${expectedFold.foldId}`,
              );
            }
          }
        }

        if (expectedFold && foldId === expectedFold.foldId) {
          canonicalIndex++;
        }
      }

      if (seenFoldIds.size !== 4) {
        pushIssue(
          issues,
          'FOLD_COUNT_MISMATCH',
          '$.folds',
          `Expected exactly 4 unique fold IDs, found ${seenFoldIds.size}`,
        );
      }

      for (let j = 0; j < validatedFolds.length; j++) {
        const foldA = validatedFolds[j] as Record<string, unknown>;
        if (!isPlainObject(foldA)) continue;
        const validationEndA = (ownDataProperty(foldA, 'innerValidationEndDate', '', issues) as { kind: 'data'; value: unknown }).value as string | undefined;
        if (!validationEndA || !validateGregorianDate(validationEndA)) continue;

        for (let k = j + 1; k < validatedFolds.length; k++) {
          const foldB = validatedFolds[k] as Record<string, unknown>;
          if (!isPlainObject(foldB)) continue;
          const validationStartB = (ownDataProperty(foldB, 'innerValidationStartDate', '', issues) as { kind: 'data'; value: unknown }).value as string | undefined;
          if (!validationStartB || !validateGregorianDate(validationStartB)) continue;

          const validationEndDate = dateFrom(validationEndA);
          const nextValidationStartDate = dateFrom(validationStartB);
          if (nextValidationStartDate <= validationEndDate) {
            pushIssue(
              issues,
              'DATE_OVERLAP',
              `$.folds[${k}].innerValidationStartDate`,
              `Validation window of fold ${j} overlaps with validation start of fold ${k}`,
            );
          }
        }
      }

      for (let j = 1; j < validatedFolds.length; j++) {
        const foldPrev = validatedFolds[j - 1] as Record<string, unknown>;
        const foldCurr = validatedFolds[j] as Record<string, unknown>;
        if (!isPlainObject(foldPrev) || !isPlainObject(foldCurr)) continue;

        const prevValidationEnd = (ownDataProperty(foldPrev, 'innerValidationEndDate', '', issues) as { kind: 'data'; value: unknown }).value as string | undefined;
        const currTrainEnd = (ownDataProperty(foldCurr, 'innerTrainEndDate', '', issues) as { kind: 'data'; value: unknown }).value as string | undefined;

        if (prevValidationEnd && currTrainEnd && validateGregorianDate(prevValidationEnd) && validateGregorianDate(currTrainEnd)) {
          const prevEndDate = dateFrom(prevValidationEnd);
          const currEndDate = dateFrom(currTrainEnd);
          if (currEndDate < prevEndDate) {
            pushIssue(
              issues,
              'DATE_OVERLAP',
              `$.folds[${j}].innerTrainEndDate`,
              'Expanding window must extend through previous validation end',
            );
          }
        }
      }

      if (expectedOuterTrainRowCount !== undefined && validatedFolds.length > 0) {
        const lastFold = validatedFolds[validatedFolds.length - 1] as Record<string, unknown>;
        if (isPlainObject(lastFold)) {
          const lastTrainResult = ownDataProperty(lastFold, 'expectedTrainRowCount', '', issues);
          const lastValidationResult = ownDataProperty(lastFold, 'expectedValidationRowCount', '', issues);
          if (
            lastTrainResult.kind === 'data' &&
            lastValidationResult.kind === 'data' &&
            Number.isSafeInteger(lastTrainResult.value) &&
            Number.isSafeInteger(lastValidationResult.value)
          ) {
            const reconciled = (lastTrainResult.value as number) + (lastValidationResult.value as number);
            if (reconciled !== expectedOuterTrainRowCount) {
              pushIssue(
                issues,
                'COUNT_MISMATCH',
                '$.expectedOuterTrainRowCount',
                `expectedOuterTrainRowCount must equal last fold train + validation rows`,
              );
            }
          }
        }
      }
    }
  }

  const finalIssues = sortIssues(issues);
  if (finalIssues.length > 0) {
    return { ok: false, issues: finalIssues };
  }

  return { ok: true, value: value as MLBTrainOnlyInnerFoldPlan };
}
