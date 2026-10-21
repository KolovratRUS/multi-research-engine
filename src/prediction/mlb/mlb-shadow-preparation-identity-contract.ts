/* -------------------------------------------------------------------------- */
/*  MLB Shadow Preparation Identity Contract (P5F-C4)                          */
/* -------------------------------------------------------------------------- */
/**
 * Frozen four-field canonical identity record that binds a shadow
 * preparation request to exactly one shadowRecordId.
 *
 * Scientific role:
 *  - SCIENTIFIC_USE = NONE
 *  - This contract is pure validation infrastructure — it carries NO
 *    prediction, model, outcome, or grading data.
 *
 * Zero-import guarantee: this module has NO imports. It is fully
 * self-contained and can be loaded in any isolation boundary.
 */

/* -------------------------------------------------------------------------- */
/*  Contract version                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Canonical contract version for the shadow preparation identity record.
 * Any record whose contractVersion does not equal this constant is rejected.
 */
export const MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION =
  'mlb-shadow-preparation-identity-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Canonical field order                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Exact, frozen canonical field order for serialization and structural
 * validation. The serialization of a record MUST emit these keys in this
 * exact order, with no whitespace and no trailing newline.
 */
export const MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER = Object.freeze([
  'contractVersion',
  'preparationRequestId',
  'gamePk',
  'shadowRecordId',
]) as readonly ['contractVersion', 'preparationRequestId', 'gamePk', 'shadowRecordId'];

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * A frozen, canonical four-field identity record.
 */
export type MLBShadowPreparationIdentityRecord = Readonly<{
  contractVersion: typeof MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION;
  preparationRequestId: string;
  gamePk: number;
  shadowRecordId: string;
}>;

/**
 * Granular issue codes produced by validation / parsing.
 */
export type MLBShadowPreparationIdentityIssueCode =
  | 'NOT_OBJECT'
  | 'EXCESS_FIELD'
  | 'ACCESSOR_PROPERTY'
  | 'MISSING_FIELD'
  | 'CONTRACT_VERSION_MISMATCH'
  | 'PREPARATION_REQUEST_ID_INVALID'
  | 'GAME_PK_INVALID'
  | 'SHADOW_RECORD_ID_INVALID'
  | 'MALFORMED_JSON';

/**
 * A single validation / parse issue with a JSON-pointer-style path.
 */
export type MLBShadowPreparationIdentityIssue = Readonly<{
  code: MLBShadowPreparationIdentityIssueCode;
  path: string;
  message: string;
}>;

/**
 * Discriminated validation result: either a frozen validated record or
 * a frozen, non-empty issues array.
 */
export type MLBShadowPreparationIdentityValidationResult =
  | Readonly<{ ok: true; value: MLBShadowPreparationIdentityRecord }>
  | Readonly<{ ok: false; issues: readonly MLBShadowPreparationIdentityIssue[] }>;

/* -------------------------------------------------------------------------- */
/*  Internal helpers (all pure, zero-dependency)                              */
/* -------------------------------------------------------------------------- */

/** Matches any Unicode control character (U+0000 – U+001F), including NUL. */
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

/**
 * True only for plain objects whose prototype is Object.prototype
 * or null (no class hierarchy, no arrays, no null).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

/**
 * True only for own string keys that are exact data-property
 * descriptors (not accessors).
 */
function isDataPropertyDescriptor(descriptor: PropertyDescriptor | undefined): boolean {
  return (
    descriptor !== undefined &&
    Object.prototype.hasOwnProperty.call(descriptor, 'value') &&
    descriptor.writable !== undefined &&
    descriptor.enumerable !== undefined &&
    descriptor.configurable !== undefined
  );
}

/**
 * Opaque-string validation: non-empty, trimmed (no leading/trailing
 * whitespace), and free of Unicode control characters.
 */
function isValidOpaqueString(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  if (value.length === 0) {
    return false;
  }
  if (value !== value.trim()) {
    return false;
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    return false;
  }
  return true;
}

/**
 * Positive safe-integer validation: typeof === 'number',
 * Number.isSafeInteger === true, and strictly positive (> 0).
 */
function isValidPositiveSafeInteger(value: unknown): value is number {
  if (typeof value !== 'number') {
    return false;
  }
  if (!Number.isSafeInteger(value)) {
    return false;
  }
  return value > 0;
}

/* -------------------------------------------------------------------------- */
/*  Validation                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Validates an unknown input against the four-field preparation-identity
 * contract.
 *
 * Checks performed (in order, all issues accumulated):
 *  1. Top-level must be a plain object (NOT_OBJECT).
 *  2. No symbol-keyed properties (ACCESSOR_PROPERTY).
 *  3. No excess / unknown string-keyed properties (EXCESS_FIELD).
 *  4. No accessor properties — only data descriptors (ACCESSOR_PROPERTY).
 *  5. All four required fields must be present as own data properties (MISSING_FIELD).
 *  6. contractVersion must equal MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION.
 *  7. preparationRequestId must be a valid opaque string.
 *  8. gamePk must be a positive safe integer.
 *  9. shadowRecordId must be a valid opaque string.
 *
 * On success, returns the frozen, canonical record.
 * On failure, returns a non-empty, frozen issues array.
 */
export function validateMLBShadowPreparationIdentityRecord(
  input: unknown,
): MLBShadowPreparationIdentityValidationResult {
  const issues: MLBShadowPreparationIdentityIssue[] = [];

  /* -- 1. plain object --------------------------------------------------- */
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          code: 'NOT_OBJECT',
          path: '$',
          message: 'Preparation identity record must be a plain object',
        },
      ]),
    };
  }

  const root = input;

  /* -- 2. symbol keys ----------------------------------------------------- */
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    issues.push({
      code: 'ACCESSOR_PROPERTY',
      path: `Symbol(${(symbol as symbol).description ?? symbol.toString()})`,
      message: 'Symbol-keyed property rejected',
    });
  }

  /* -- 3 & 4. string keys: excess / accessor check ----------------------- */
  const ownStringKeys = Object.getOwnPropertyNames(root);
  const fieldSet: Set<string> = new Set<string>(MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER);
  const presentKeys = new Set(ownStringKeys);

  for (const key of ownStringKeys) {
    if (!fieldSet.has(key)) {
      issues.push({
        code: 'EXCESS_FIELD',
        path: `$.${key}`,
        message: `Unknown field: ${key}`,
      });
    }
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (descriptor !== undefined && !isDataPropertyDescriptor(descriptor)) {
      issues.push({
        code: 'ACCESSOR_PROPERTY',
        path: `$.${key}`,
        message: `Property must be a data descriptor: ${key}`,
      });
    }
  }

  /* -- 5. missing required fields ---------------------------------------- */
  for (const field of MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER) {
    if (!presentKeys.has(field)) {
      issues.push({
        code: 'MISSING_FIELD',
        path: `$.${field}`,
        message: `Required field is missing: ${field}`,
      });
    }
  }

  /* -- 6-9. value validation for fields present as data descriptors only -- */
  /* Accessor and missing fields are already reported by structural checks   */
  /* above; value validation is skipped for them to avoid invoking getters. */
  for (const field of MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER) {
    if (!presentKeys.has(field)) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(root, field);
    if (descriptor === undefined || !isDataPropertyDescriptor(descriptor)) {
      continue;
    }

    const value = root[field];

    if (field === 'contractVersion') {
      if (value !== MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION) {
        issues.push({
          code: 'CONTRACT_VERSION_MISMATCH',
          path: '$.contractVersion',
          message: 'contractVersion must equal mlb-shadow-preparation-identity-v1',
        });
      }
    } else if (field === 'preparationRequestId') {
      if (!isValidOpaqueString(value)) {
        issues.push({
          code: 'PREPARATION_REQUEST_ID_INVALID',
          path: '$.preparationRequestId',
          message:
            'preparationRequestId must be a non-empty trimmed string without control characters',
        });
      }
    } else if (field === 'gamePk') {
      if (!isValidPositiveSafeInteger(value)) {
        issues.push({
          code: 'GAME_PK_INVALID',
          path: '$.gamePk',
          message: 'gamePk must be a positive safe integer',
        });
      }
    } else if (field === 'shadowRecordId') {
      if (!isValidOpaqueString(value)) {
        issues.push({
          code: 'SHADOW_RECORD_ID_INVALID',
          path: '$.shadowRecordId',
          message:
            'shadowRecordId must be a non-empty trimmed string without control characters',
        });
      }
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues: Object.freeze(issues) };
  }

  /* -- Construct frozen canonical record --------------------------------- */
  const validated: MLBShadowPreparationIdentityRecord = Object.freeze({
    contractVersion: MLB_SHADOW_PREPARATION_IDENTITY_CONTRACT_VERSION,
    preparationRequestId: root['preparationRequestId'] as string,
    gamePk: root['gamePk'] as number,
    shadowRecordId: root['shadowRecordId'] as string,
  });

  return { ok: true, value: validated };
}

/* -------------------------------------------------------------------------- */
/*  Canonical serialization                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Deterministic canonical JSON serialization of a validated identity record.
 *
 * Emits exactly four keys in MLB_SHADOW_PREPARATION_IDENTITY_FIELD_ORDER,
 * with no whitespace and no trailing newline. The output is byte-stable
 * for any input that passes validation.
 */
export function canonicalSerializeMLBShadowPreparationIdentityRecord(
  record: MLBShadowPreparationIdentityRecord,
): string {
  return JSON.stringify({
    contractVersion: record.contractVersion,
    preparationRequestId: record.preparationRequestId,
    gamePk: record.gamePk,
    shadowRecordId: record.shadowRecordId,
  });
}

/* -------------------------------------------------------------------------- */
/*  Safe parsing (JSON.parse + validate)                                      */
/* -------------------------------------------------------------------------- */

/**
 * Safely parses a JSON string and validates it as a preparation-identity
 * record. Does NOT throw — all parse and validation errors are returned
 * as `{ ok: false, issues: [...] }`.
 *
 * The function accepts a `string` parameter. If a non-string is passed
 * (defensive runtime guard), it returns a MALFORMED_JSON issue.
 */
export function parseMLBShadowPreparationIdentityRecord(
  input: string,
): MLBShadowPreparationIdentityValidationResult {
  if (typeof input !== 'string') {
    return {
      ok: false,
      issues: Object.freeze([
        {
          code: 'MALFORMED_JSON',
          path: '$',
          message: 'Input must be a string for JSON parsing',
        },
      ]),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch {
    return {
      ok: false,
      issues: Object.freeze([
        {
          code: 'MALFORMED_JSON',
          path: '$',
          message: 'Input is not valid JSON',
        },
      ]),
    };
  }

  return validateMLBShadowPreparationIdentityRecord(parsed);
}
