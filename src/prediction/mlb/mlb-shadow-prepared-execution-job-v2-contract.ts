/* -------------------------------------------------------------------------- */
/*  Additive shadow prepared-execution-job contract (P5F-A1-R1)              */
/* -------------------------------------------------------------------------- */
/**
 * Portable, durable prepared-job value contract for V2.
 *
 * PHASE SCOPE (this phase builds ONLY the contract + validator + tests):
 *  - Validates caller-supplied prepared-job input only.
 *  - NO filesystem persistence. NO reader/loader. NO factory. NO CLI.
 *  - NO network. NO model fitting/reconstruction. No clock. No randomness.
 *
 * The prepared job freezes ALL scientific/pregame execution inputs EXCEPT
 * repoRoot (runtime filesystem context). Future execution injects ONLY
 * repoRoot, then calls validateMLBShadowExecutionJobV2 followed by
 * executeMLBShadowExecutionJobV2.
 *
 * The full authorized Candidate-003 artifact remains embedded. No scientific
 * input is dropped.
 *
 * This contract reuses validateMLBShadowExecutionJobV2 for all nested/per-field
 * validation. It adds ONLY a top-level prepared-shape gate that rejects
 * repoRoot, unknown keys, symbol keys, accessor properties, and missing fields
 * BEFORE delegating to the authoritative V2 validator via an in-memory,
 * validation-only repoRoot sentinel.
 *
 * SCIENTIFIC / BLINDNESS LOCK (operational only):
 *   S1_SCIENTIFIC_ROLE            = NONE
 *   SCIENTIFIC_USE                = NONE
 *   IS_PROSPECTIVE_HOLDOUT_EVIDENCE = false
 *   ELIGIBLE_FOR_FUTURE_VALIDATION  = false
 *   ELIGIBLE_FOR_FUTURE_TEST        = false
 *
 * No odds/sportsbook information enters this contract.
 */

import {
  validateMLBShadowExecutionJobV2,
  type MLBShadowExecutionJobV2,
} from '@/prediction/mlb/mlb-shadow-execution-job-v2-contract';

/* -------------------------------------------------------------------------- */
/*  Contract version                                                          */
/* -------------------------------------------------------------------------- */
/**
 * Immutable identifier of this prepared-job contract version. This is a
 * code-level constant and is NOT embedded in the validated prepared-job value,
 * so the validated value maps 1:1 to the V2 execution job minus repoRoot.
 */
export const MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_CONTRACT_VERSION =
  'mlb-shadow-prepared-execution-job-v2-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Issue model                                                               */
/* -------------------------------------------------------------------------- */
/**
 * Fixed, finite issue codes. Messages are fixed templates and never echo raw
 * prediction values, probabilities, model coefficients, snapshot contents, raw
 * objects, stack traces, or arbitrary error.text. Only safe top-level field
 * paths are emitted.
 */
export type MLBShadowPreparedExecutionJobV2IssueCode =
  | 'NOT_PREPARED_OBJECT'
  | 'PREPARED_JOB_INVALID';

export type MLBShadowPreparedExecutionJobV2ValidationIssue = Readonly<{
  code: MLBShadowPreparedExecutionJobV2IssueCode;
  path: string;
  message: string;
}>;

export type MLBShadowPreparedExecutionJobV2ValidationResult =
  | Readonly<{
      ok: true;
      value: MLBShadowPreparedExecutionJobV2;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBShadowPreparedExecutionJobV2ValidationIssue[];
    }>;

/* -------------------------------------------------------------------------- */
/*  Immutable prepared-job type (full-embed; repoRoot omitted)                */
/* -------------------------------------------------------------------------- */
/**
 * One fully prepared S1 shadow prepared execution job (V2 full-embed).
 *
 * Structurally equivalent to Omit<MLBShadowExecutionJobV2, 'repoRoot'>.
 * Contains exactly 13 fields. The complete authorizedModelArtifact is embedded.
 * No scientific input is dropped.
 *
 * The object is shallow-frozen (top-level readonly), matching the existing
 * repository contract patterns; nested model/snapshot objects are passed
 * through as opaque validated references from validateMLBShadowExecutionJobV2.
 */
export type MLBShadowPreparedExecutionJobV2 = Omit<
  MLBShadowExecutionJobV2,
  'repoRoot'
>;

/* -------------------------------------------------------------------------- */
/*  Canonical field order (future store serialization order)                  */
/* -------------------------------------------------------------------------- */
/**
 * Immutable canonical field order for the prepared job value. This is the exact
 * V2 execution-job order after removing repoRoot. The future prepared-job store
 * will use this order for its canonical serialization.
 *
 * Field count:
 *   PREPARED_JOB_FIELD_COUNT = 13
 */
export const MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER: ReadonlyArray<string> = [
  'shadowRecordId',
  'gamePk',
  'predictionGeneratedAt',
  'authorizedModelArtifact',
  'featureManifest',
  'snapshot',
  'officialDate',
  'scheduledStartAt',
  'latencyMs',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
] as const;

/* -------------------------------------------------------------------------- */
/*  Validation-only repoRoot sentinel                                         */
/* -------------------------------------------------------------------------- */
/**
 * In-memory-only sentinel injected as repoRoot to delegate to
 * validateMLBShadowExecutionJobV2. This satisfies V2's required repoRoot field
 * purely for validation delegation — it is NOT a real filesystem path.
 *
 * NEVER exported. NEVER returned. NEVER serialized. NEVER written.
 * NEVER passed to namespace resolution or any filesystem code.
 */
const PREPARED_JOB_VALIDATION_REPOROOT_SENTINEL =
  '/__mre_shadow_prepared_job_validation_only__';

/* -------------------------------------------------------------------------- */
/*  Field allowlist set (derived from the canonical order)                    */
/* -------------------------------------------------------------------------- */
const PREPARED_TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set<
  string
>(MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER);

/* -------------------------------------------------------------------------- */
/*  Structural helpers (pure; prepared-specific)                              */
/* -------------------------------------------------------------------------- */
function isPlainObject(
  value: unknown,
): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return (
    !!descriptor &&
    Object.prototype.hasOwnProperty.call(descriptor, 'value')
  );
}

/* -------------------------------------------------------------------------- */
/*  Top-level prepared-shape gate                                             */
/*                                                                          */
/*  Validates ONLY:                                                           */
/*    - plain object (not primitive, not null, not array)                    */
/*    - EXACTLY the 13 authorized prepared fields as own DATA properties       */
/*    - rejects repoRoot (must be omitted from prepared job)                  */
/*    - rejects unknown string keys                                            */
/*    - rejects symbol keys                                                    */
/*    - rejects accessor/getter/setter descriptors                           */
/*    - rejects inherited-only values (only own properties accepted)         */
/*                                                                          */
/*  Does NOT duplicate nested or per-field V2 validation.                      */
/* -------------------------------------------------------------------------- */
function gatePreparedTopLevelShape(
  root: Record<string, unknown>,
): readonly MLBShadowPreparedExecutionJobV2ValidationIssue[] {
  const issues: MLBShadowPreparedExecutionJobV2ValidationIssue[] = [];

  // B. Inspect OWN top-level keys WITHOUT invoking getters.
  //    Object.getOwnPropertyNames returns own string keys (enumerable +
  //    non-enumerable) without triggering accessors.
  const ownStringKeys = Object.getOwnPropertyNames(root);
  const ownSymbolKeys = Object.getOwnPropertySymbols(root);

  // D. reject symbol keys
  for (const symbol of ownSymbolKeys) {
    issues.push({
      code: 'PREPARED_JOB_INVALID',
      path: `Symbol(${symbol.description ?? symbol.toString()})`,
      message: 'Symbol property rejected',
    });
  }

  // C & D. Check each own string key against the authorized field set.
  for (const key of ownStringKeys) {
    // D. reject repoRoot (must be omitted from the prepared job)
    if (key === 'repoRoot') {
      issues.push({
        code: 'PREPARED_JOB_INVALID',
        path: '$.repoRoot',
        message: 'repoRoot is omitted from the prepared job',
      });
      continue;
    }
    // D. reject unknown string keys
    if (!PREPARED_TOP_LEVEL_FIELDS.has(key)) {
      issues.push({
        code: 'PREPARED_JOB_INVALID',
        path: `$.${key}`,
        message: 'Unknown prepared job field',
      });
      continue;
    }
    // E. all accepted top-level fields must be own DATA properties
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (!descriptor || !isDataDescriptor(descriptor)) {
      issues.push({
        code: 'PREPARED_JOB_INVALID',
        path: `$.${key}`,
        message: 'Field must be a data property',
      });
    }
  }

  // D. reject missing required fields (inherited-only values are not own
  //    properties and therefore fail hasOwnProperty).
  for (const field of MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER) {
    if (!Object.prototype.hasOwnProperty.call(root, field)) {
      issues.push({
        code: 'PREPARED_JOB_INVALID',
        path: `$.${field}`,
        message: 'Required prepared job field is missing',
      });
    }
  }

  return Object.freeze(issues);
}

/* -------------------------------------------------------------------------- */
/*  Prepared-job validator                                                    */
/* -------------------------------------------------------------------------- */
/**
 * Validates a fully prepared S1 shadow prepared execution job (V2 full-embed).
 *
 * Fail-closed: any top-level shape violation OR any V2 structural/identity
 * failure yields ok === false with a fixed, safe issue list. On success, a NEW
 * shallow-frozen 13-field immutable prepared object is returned in exact
 * canonical field order; the caller's input is never mutated or returned.
 *
 * Top-level prepared-shape validation is performed FIRST via an exact 13-field
 * gate. Only after the gate passes is an in-memory validation-only repoRoot
 * sentinel injected and validateMLBShadowExecutionJobV2 is called for all
 * nested/per-field validation. V2 validation failures are collapsed to a
 * single safe PREPARED_JOB_INVALID issue — no sensitive nested values are
 * exposed.
 */
export function validateMLBShadowPreparedExecutionJobV2(
  input: unknown,
): MLBShadowPreparedExecutionJobV2ValidationResult {
  // A. require input to be a plain object
  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: Object.freeze([
        {
          code: 'NOT_PREPARED_OBJECT',
          path: '$',
          message: 'Prepared execution job must be a plain object',
        },
      ]),
    };
  }

  const root = input;

  // B–E. Top-level prepared-shape gate (own data properties only).
  const gateIssues = gatePreparedTopLevelShape(root);
  if (gateIssues.length > 0) {
    return {
      ok: false,
      issues: gateIssues,
    };
  }

  // Construct a NEW 14-field candidate explicitly from DATA descriptor values
  // (never mutating the input, never invoking getters) plus the in-memory
  // validation-only repoRoot sentinel.
  const candidate: Record<string, unknown> = {
    repoRoot: PREPARED_JOB_VALIDATION_REPOROOT_SENTINEL,
  };
  for (const field of MLB_SHADOW_PREPARED_EXECUTION_JOB_V2_FIELD_ORDER) {
    const descriptor = Object.getOwnPropertyDescriptor(root, field);
    // Gate guarantees this is a data descriptor with a value.
    candidate[field] = isDataDescriptor(descriptor)
      ? descriptor.value
      : undefined;
  }

  // Delegate to the authoritative V2 validator for all nested/per-field
  // validation (manifest fingerprint, model artifact identity, snapshot
  // structure, cross-field checks, etc.).
  const v2Result = validateMLBShadowExecutionJobV2(candidate);

  if (!v2Result.ok) {
    // Collapse V2 failures to a single safe issue — no sensitive nested
    // values (model coefficients, snapshot data, etc.) are exposed.
    return {
      ok: false,
      issues: Object.freeze([
        {
          code: 'PREPARED_JOB_INVALID',
          path: '$',
          message: 'Prepared job failed V2 structural validation',
        },
      ]),
    };
  }

  // Construct a NEW 13-field prepared object explicitly from the V2 validated
  // value, in exact canonical field order, omitting repoRoot.
  const preparedValue: MLBShadowPreparedExecutionJobV2 = Object.freeze({
    shadowRecordId: v2Result.value.shadowRecordId,
    gamePk: v2Result.value.gamePk,
    predictionGeneratedAt: v2Result.value.predictionGeneratedAt,
    authorizedModelArtifact: v2Result.value.authorizedModelArtifact,
    featureManifest: v2Result.value.featureManifest,
    snapshot: v2Result.value.snapshot,
    officialDate: v2Result.value.officialDate,
    scheduledStartAt: v2Result.value.scheduledStartAt,
    latencyMs: v2Result.value.latencyMs,
    featureManifestId: v2Result.value.featureManifestId,
    featureManifestFingerprint: v2Result.value.featureManifestFingerprint,
    timingReferenceContractVersion: v2Result.value.timingReferenceContractVersion,
    timingReferenceCutoffAt: v2Result.value.timingReferenceCutoffAt,
  });

  return {
    ok: true,
    value: preparedValue,
  };
}
