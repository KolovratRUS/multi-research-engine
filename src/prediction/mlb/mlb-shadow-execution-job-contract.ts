/* -------------------------------------------------------------------------- */
/*  Immutable shadow execution-job contract (L5E2V-C1)                         */
/* -------------------------------------------------------------------------- */
/**
 * Pure, side-effect-free input contract for one fully prepared S1 shadow
 * execution job.
 *
 * PHASE SCOPE (this phase builds ONLY the contract + validator + tests):
 *  - No runtime adapter. No CLI. No commit. No push.
 *  - No schedule lookup. No TRAIN loading/fitting. No prediction execution.
 *  - No prediction / operational persistence. No outcome. No grading.
 *
 * This contract validates CALLER-SUPPLIED values only. It generates nothing
 * (no Date.now(), new Date(), crypto.randomUUID(), randomBytes(), Math.random()).
 *
 * CONCEPTUAL FUTURE FLOW:
 *   upstream preparation  ->  MLBShadowExecutionJobV1  ->  future L5E2V adapter
 *                                                       ->  existing L5E2U (L5E2S/L5E2Q)
 *
 * SCIENTIFIC / BLINDNESS LOCK (operational only):
 *   S1_SCIENTIFIC_ROLE            = NONE
 *   SCIENTIFIC_USE                = NONE
 *   IS_PROSPECTIVE_HOLDOUT_EVIDENCE = false
 *   ELIGIBLE_FOR_FUTURE_VALIDATION  = false
 *   ELIGIBLE_FOR_FUTURE_TEST        = false
 *
 * No sportsbook information may enter the contract: odds, prices, lines,
 * spreads, totals, implied probability, market probability, market consensus,
 * value, edge, EV, or bookmaker data are NOT represented by any field.
 *
 * SHADOW_RECORD_ID_GENERATION = CALLER_RESPONSIBILITY
 *   (caller-supplied, opaque, non-empty, stable across retries; the contract
 *    cannot and does not derive an id from gamePk / prediction / probability /
 *    model / snapshot / feature vector / timestamp.)
 *
 * STABLE-RETRY INVARIANT (documentation only; no runtime hash):
 *   For the same physical logical retry attempt, the following MUST remain
 *   stable. Changing any of them directs the invocation to a different durable
 *   artifact store / operational record and is therefore a DISTINCT execution:
 *     repoRoot, shadowRecordId, gamePk, predictionGeneratedAt,
 *     releasedModelResult (candidate-003 identity), featureManifest (frozen
 *     real-pregame manifest identity), snapshot (canonical pregame identity),
 *     officialDate, scheduledStartAt, latencyMs, featureManifestId,
 *     featureManifestFingerprint, timingReferenceContractVersion,
 *     timingReferenceCutoffAt.
 *   NOTE: repoRoot is NOT part of the serialized operational record bytes; it
 *   selects the persistence namespace/location. A different repoRoot targets a
 *   different physical artifact store and is therefore not the same retry.
 */

import {
  validateMLBModelTestReleaseResult,
  type MLBModelTestReleaseResult,
} from '@/prediction/mlb/mlb-model-test-release-contract';
import {
  verifyMLBShadowCandidate003AuthoritativeModel,
} from '@/prediction/mlb/mlb-shadow-model-fingerprint';
import {
  validateMLBFeatureManifest,
  type MLBFeatureManifest,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  computeMLBFeatureManifestFingerprint,
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  validateMLBCanonicalPregameSnapshot,
  type MLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';

/* -------------------------------------------------------------------------- */
/*  Contract version                                                          */
/* -------------------------------------------------------------------------- */
/**
 * Immutable identifier of this input contract version. Remains an exported
 * constant and is NOT embedded in the validated job object, so the validated
 * job maps 1:1 to the existing L5E2U input (MLBShadowQuarantineOrchestratorInput)
 * without requiring the future adapter to strip a version field.
 */
export const MLB_SHADOW_EXECUTION_JOB_CONTRACT_VERSION =
  'mlb-shadow-execution-job-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Issue model                                                               */
/* -------------------------------------------------------------------------- */
/**
 * Fixed structural issue codes. Messages are fixed templates and never echo
 * raw prediction values, probabilities, model coefficients, snapshot contents,
 * raw objects, stack traces, or arbitrary error.message. Field paths are safe
 * field identity only.
 */
export type MLBShadowExecutionJobIssueCode =
  | 'NOT_PLAIN_OBJECT'
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'INVALID_STRING'
  | 'INVALID_INTEGER'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_DATE'
  | 'INVALID_HASH'
  | 'INVALID_JSON_VALUE'
  | 'RELEASE_RESULT_INVALID'
  | 'MODEL_NOT_AUTHORITATIVE'
  | 'MANIFEST_INVALID'
  | 'MANIFEST_FINGERPRINT_MISMATCH'
  | 'SNAPSHOT_INVALID'
  | 'ODDS_CONTAMINATION'
  | 'PROHIBITED_CONCEPT'
  | 'SOURCE_IDENTITY_MISMATCH';

export type MLBShadowExecutionJobValidationIssue = Readonly<{
  code: MLBShadowExecutionJobIssueCode;
  path: string;
  message: string;
}>;

export type MLBShadowExecutionJobValidationResult =
  | Readonly<{ ok: true; value: MLBShadowExecutionJobV1 }>
  | Readonly<{ ok: false; issues: readonly MLBShadowExecutionJobValidationIssue[] }>;

/* -------------------------------------------------------------------------- */
/*  Immutable job type                                                          */
/* -------------------------------------------------------------------------- */
/**
 * One fully prepared S1 shadow execution job.
 *
 * Contains EXACTLY the L5E2U (L5E2S/L5E2Q) execution input values it is
 * constructed to carry. Required scalars are non-null; optional metadata is
 * canonicalized to `null` when omitted (the caller may pass undefined or null
 * for any optional field). The object is shallow-frozen (top-level readonly),
 * matching existing repository contract patterns; nested model/snapshot
 * objects are passed through as opaque validated references.
 */
export type MLBShadowExecutionJobV1 = Readonly<{
  repoRoot: string;
  shadowRecordId: string;
  gamePk: number;
  predictionGeneratedAt: string;
  releasedModelResult: MLBModelTestReleaseResult;
  featureManifest: MLBFeatureManifest;
  snapshot: MLBCanonicalPregameSnapshot;
  officialDate: string | null;
  scheduledStartAt: string | null;
  latencyMs: number | null;
  featureManifestId: string | null;
  featureManifestFingerprint: string | null;
  timingReferenceContractVersion: string | null;
  timingReferenceCutoffAt: string | null;
}>;

/* -------------------------------------------------------------------------- */
/*  Authorized top-level field allowlist                                       */
/* -------------------------------------------------------------------------- */
/**
 * Strict top-level allowlist. Any key not present here is rejected as
 * UNKNOWN_FIELD — which is how prohibited operational/sportsbook concepts
 * (odds, sportsbook, result, outcome, correct, correctness, grading,
 * performance, predictedWinner, homeWinProbability, payloadHash, ...) are kept
 * out of the job object.
 */
const AUTHORIZED_TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set<string>([
  'repoRoot',
  'shadowRecordId',
  'gamePk',
  'predictionGeneratedAt',
  'releasedModelResult',
  'featureManifest',
  'snapshot',
  'officialDate',
  'scheduledStartAt',
  'latencyMs',
  'featureManifestId',
  'featureManifestFingerprint',
  'timingReferenceContractVersion',
  'timingReferenceCutoffAt',
]);

/* -------------------------------------------------------------------------- */
/*  Structural helpers (pure; mirror existing repository contract helpers)     */
/* -------------------------------------------------------------------------- */
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

const TIMESTAMP_RE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const SHA256_RE = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function isDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return !!descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value');
}

type PropertyRead =
  | Readonly<{ kind: 'data'; value: unknown }>
  | Readonly<{ kind: 'missing' }>
  | Readonly<{ kind: 'accessor' }>;

/**
 * Reads an own data property WITHOUT invoking getters. Caller-supplied inputs
 * must never trigger arbitrary accessor side effects during validation.
 */
function ownDataProperty(
  root: Record<string, unknown>,
  key: string,
): PropertyRead {
  const descriptor = Object.getOwnPropertyDescriptor(root, key);
  if (!descriptor) {
    return { kind: 'missing' };
  }
  if (!isDataDescriptor(descriptor)) {
    return { kind: 'accessor' };
  }
  return { kind: 'data', value: descriptor.value };
}

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function isValidTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  if (trimmed.length < 11) return false;
  if (!TIMESTAMP_RE.test(trimmed)) return false;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed);
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed !== value) return false;
  if (!DATE_RE.test(trimmed)) return false;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed);
}

function isPositiveInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value > 0
  );
}

function isNonNegativeInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0
  );
}

function isValidHash(value: unknown): value is string {
  return typeof value === 'string' && SHA256_RE.test(value);
}

/* -------------------------------------------------------------------------- */
/*  Issue accumulation                                                        */
/* -------------------------------------------------------------------------- */
function pushIssue(
  issues: MLBShadowExecutionJobValidationIssue[],
  code: MLBShadowExecutionJobIssueCode,
  path: string,
  message: string,
): void {
  if (!issues.some((item) => item.path === path && item.code === code)) {
    issues.push({ code, path, message });
  }
}

function sortIssues(
  issues: MLBShadowExecutionJobValidationIssue[],
): readonly MLBShadowExecutionJobValidationIssue[] {
  return Object.freeze(
    issues
      .slice()
      .sort(
        (a, b) =>
          (a.path < b.path ? -1 : a.path === b.path ? 0 : 1) ||
          (a.code < b.code ? -1 : a.code === b.code ? 0 : 1),
      )
      .filter(
        (item, index, array) =>
          index === 0 ||
          item.path !== array[index - 1].path ||
          item.code !== array[index - 1].code,
      ),
  );
}

type DownstreamIssue = Readonly<{ readonly code: string; readonly path: string }>;

/**
 * Collapses a downstream sub-validation failure into at most ONE fixed, safe
 * job issue. ODDS_CONTAMINATION / PROHIBITED_CONCEPT signals are preserved
 * (these are the odds-blind guarantee carried by the existing validators);
 * all other downstream codes collapse to a single fixed code with a fixed
 * message. Downstream messages are never forwarded (no arbitrary error.text),
 * and only the safe top-level sub-object path is emitted.
 */
function pushCollapsedIssue(
  issues: MLBShadowExecutionJobValidationIssue[],
  downstream: readonly DownstreamIssue[],
  collapsedCode: MLBShadowExecutionJobIssueCode,
  topPath: string,
  label: string,
): void {
  if (downstream.length === 0) {
    return;
  }
  const hasOdds = downstream.some((i) => i.code === 'ODDS_CONTAMINATION');
  const hasProhibited = downstream.some((i) => i.code === 'PROHIBITED_CONCEPT');
  if (hasOdds) {
    pushIssue(
      issues,
      'ODDS_CONTAMINATION',
      topPath,
      `${label} contains a prohibited odds/sportsbook field`,
    );
    return;
  }
  if (hasProhibited) {
    pushIssue(
      issues,
      'PROHIBITED_CONCEPT',
      topPath,
      `${label} contains a prohibited sensitive field`,
    );
    return;
  }
  pushIssue(
    issues,
    collapsedCode,
    topPath,
    `${label} failed structural validation`,
  );
}

/* -------------------------------------------------------------------------- */
/*  Field readers                                                               */
/* -------------------------------------------------------------------------- */
function readRequiredString(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowExecutionJobValidationIssue[],
): string | undefined {
  const read = ownDataProperty(root, key);
  if (read.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return undefined;
  }
  if (read.kind === 'accessor') {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${key} must be a data property`,
    );
    return undefined;
  }
  const { value } = read;
  if (!isStrictNonEmptyTrimmedString(value)) {
    pushIssue(
      issues,
      'INVALID_STRING',
      path,
      `${key} must be a non-empty trimmed string`,
    );
    return undefined;
  }
  return value;
}

function readRequiredPositiveInteger(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowExecutionJobValidationIssue[],
): number | undefined {
  const read = ownDataProperty(root, key);
  if (read.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return undefined;
  }
  if (read.kind === 'accessor') {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${key} must be a data property`,
    );
    return undefined;
  }
  const { value } = read;
  if (!isPositiveInteger(value)) {
    pushIssue(
      issues,
      'INVALID_INTEGER',
      path,
      `${key} must be a positive integer`,
    );
    return undefined;
  }
  return value;
}

function readRequiredTimestamp(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowExecutionJobValidationIssue[],
): string | undefined {
  const read = ownDataProperty(root, key);
  if (read.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${key} is required`);
    return undefined;
  }
  if (read.kind === 'accessor') {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${key} must be a data property`,
    );
    return undefined;
  }
  const { value } = read;
  if (!isValidTimestamp(value)) {
    pushIssue(
      issues,
      'INVALID_TIMESTAMP',
      path,
      `${key} must be a valid RFC 3339 timestamp`,
    );
    return undefined;
  }
  return value;
}

function readRequiredDataProperty(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowExecutionJobValidationIssue[],
  label: string,
): unknown | undefined {
  const read = ownDataProperty(root, key);
  if (read.kind === 'missing') {
    pushIssue(issues, 'MISSING_FIELD', path, `${label} is required`);
    return undefined;
  }
  if (read.kind === 'accessor') {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${label} must be a data property`,
    );
    return undefined;
  }
  return read.value;
}

function readOptionalString(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowExecutionJobValidationIssue[],
  label: string,
): string | null {
  const read = ownDataProperty(root, key);
  if (read.kind === 'missing') {
    return null;
  }
  if (read.kind === 'accessor') {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${label} must be a data property`,
    );
    return null;
  }
  const { value } = read;
  if (value === null) {
    return null;
  }
  if (!isStrictNonEmptyTrimmedString(value)) {
    pushIssue(
      issues,
      'INVALID_STRING',
      path,
      `${label} must be a non-empty trimmed string`,
    );
    return null;
  }
  return value;
}

function readOptionalDate(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowExecutionJobValidationIssue[],
  label: string,
): string | null {
  const read = ownDataProperty(root, key);
  if (read.kind === 'missing') {
    return null;
  }
  if (read.kind === 'accessor') {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${label} must be a data property`,
    );
    return null;
  }
  const { value } = read;
  if (value === null) {
    return null;
  }
  if (!isValidDate(value)) {
    pushIssue(
      issues,
      'INVALID_DATE',
      path,
      `${label} must be a YYYY-MM-DD date`,
    );
    return null;
  }
  return value;
}

function readOptionalTimestamp(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowExecutionJobValidationIssue[],
  label: string,
): string | null {
  const read = ownDataProperty(root, key);
  if (read.kind === 'missing') {
    return null;
  }
  if (read.kind === 'accessor') {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${label} must be a data property`,
    );
    return null;
  }
  const { value } = read;
  if (value === null) {
    return null;
  }
  if (!isValidTimestamp(value)) {
    pushIssue(
      issues,
      'INVALID_TIMESTAMP',
      path,
      `${label} must be a valid RFC 3339 timestamp`,
    );
    return null;
  }
  return value;
}

function readOptionalNonNegativeInteger(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowExecutionJobValidationIssue[],
  label: string,
): number | null {
  const read = ownDataProperty(root, key);
  if (read.kind === 'missing') {
    return null;
  }
  if (read.kind === 'accessor') {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${label} must be a data property`,
    );
    return null;
  }
  const { value } = read;
  if (value === null) {
    return null;
  }
  if (!isNonNegativeInteger(value)) {
    pushIssue(
      issues,
      'INVALID_INTEGER',
      path,
      `${label} must be a non-negative integer`,
    );
    return null;
  }
  return value;
}

function readOptionalHash(
  root: Record<string, unknown>,
  key: string,
  path: string,
  issues: MLBShadowExecutionJobValidationIssue[],
  label: string,
): string | null {
  const read = ownDataProperty(root, key);
  if (read.kind === 'missing') {
    return null;
  }
  if (read.kind === 'accessor') {
    pushIssue(
      issues,
      'INVALID_JSON_VALUE',
      path,
      `${label} must be a data property`,
    );
    return null;
  }
  const { value } = read;
  if (value === null) {
    return null;
  }
  if (!isValidHash(value)) {
    pushIssue(
      issues,
      'INVALID_HASH',
      path,
      `${label} must be a 64-character lowercase hex string`,
    );
    return null;
  }
  return value;
}

function validateUnknownTopLevelFields(
  root: Record<string, unknown>,
  issues: MLBShadowExecutionJobValidationIssue[],
): void {
  for (const key of Object.getOwnPropertyNames(root)) {
    if (AUTHORIZED_TOP_LEVEL_FIELDS.has(key)) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(root, key);
    if (!descriptor) {
      continue;
    }
    if (!isDataDescriptor(descriptor)) {
      pushIssue(
        issues,
        'INVALID_JSON_VALUE',
        `$.${key}`,
        `Unknown accessor property: ${key}`,
      );
      continue;
    }
    pushIssue(issues, 'UNKNOWN_FIELD', `$.${key}`, `Unknown field: ${key}`);
  }
  for (const symbol of Object.getOwnPropertySymbols(root)) {
    pushIssue(
      issues,
      'UNKNOWN_FIELD',
      `$[${String(symbol)}]`,
      `Symbol property rejected: ${symbol.description ?? symbol.toString()}`,
    );
  }
}

/* -------------------------------------------------------------------------- */
/*  Fail-closed invariant guard (no ! / no casts; runtime narrowing only)      */
/* -------------------------------------------------------------------------- */
/**
 * Called only on the success path (issues.length === 0), where every required
 * read is guaranteed defined. Throws a fixed invariant message (no sensitive
 * data) if that invariant ever breaks — a defensive fail-closed guard.
 */
function requireValidated<T>(value: T | undefined): T {
  if (value === undefined) {
    throw new Error('Invariant: validated field is undefined on success path');
  }
  return value;
}

/* -------------------------------------------------------------------------- */
/*  Top-level validator                                                         */
/* -------------------------------------------------------------------------- */
/**
 * Validates a fully prepared S1 shadow execution job.
 *
 * Fail-closed: any structural or identity failure yields ok === false with a
 * fixed, safe issue list. On success, a NEW shallow-frozen immutable job is
 * returned; the caller's input object is never mutated or returned.
 *
 * Order mirrors existing L5E2Q (computeMLBShadowQuarantinedPrediction):
 *   1. release-result structural validation
 *   2. candidate-003 authoritative model identity
 *   (then manifest/snapshot structural + frozen-identity validation, which L5E2Q
 *    defers to L5E2U inference but this contract prepares explicitly.)
 */
export function validateMLBShadowExecutionJob(
  input: unknown,
): MLBShadowExecutionJobValidationResult {
  const issues: MLBShadowExecutionJobValidationIssue[] = [];

  if (!isPlainObject(input)) {
    return {
      ok: false,
      issues: [
        {
          code: 'NOT_PLAIN_OBJECT',
          path: '$',
          message: 'Shadow execution job must be a plain object',
        },
      ],
    };
  }

  const root = input as Record<string, unknown>;

  // 1. Strict top-level allowlist (rejects odds/sportsbook/result/outcome/...).
  validateUnknownTopLevelFields(root, issues);

  // 2. Required scalar fields (caller-supplied; never generated).
  const repoRoot = readRequiredString(root, 'repoRoot', '$.repoRoot', issues);
  const shadowRecordId = readRequiredString(
    root,
    'shadowRecordId',
    '$.shadowRecordId',
    issues,
  );
  const gamePk = readRequiredPositiveInteger(
    root,
    'gamePk',
    '$.gamePk',
    issues,
  );
  const predictionGeneratedAt = readRequiredTimestamp(
    root,
    'predictionGeneratedAt',
    '$.predictionGeneratedAt',
    issues,
  );

  // 3. Optional metadata fields (canonicalized to null when omitted; never generated).
  const officialDate = readOptionalDate(
    root,
    'officialDate',
    '$.officialDate',
    issues,
    'officialDate',
  );
  const scheduledStartAt = readOptionalTimestamp(
    root,
    'scheduledStartAt',
    '$.scheduledStartAt',
    issues,
    'scheduledStartAt',
  );
  const latencyMs = readOptionalNonNegativeInteger(
    root,
    'latencyMs',
    '$.latencyMs',
    issues,
    'latencyMs',
  );
  const featureManifestId = readOptionalString(
    root,
    'featureManifestId',
    '$.featureManifestId',
    issues,
    'featureManifestId',
  );
  const featureManifestFingerprint = readOptionalHash(
    root,
    'featureManifestFingerprint',
    '$.featureManifestFingerprint',
    issues,
    'featureManifestFingerprint',
  );
  const timingReferenceContractVersion = readOptionalString(
    root,
    'timingReferenceContractVersion',
    '$.timingReferenceContractVersion',
    issues,
    'timingReferenceContractVersion',
  );
  const timingReferenceCutoffAt = readOptionalTimestamp(
    root,
    'timingReferenceCutoffAt',
    '$.timingReferenceCutoffAt',
    issues,
    'timingReferenceCutoffAt',
  );

  // 4. releasedModelResult: structural validation (calls odds firewall) +
  //    candidate-003 authoritative model identity.
  const releasedModelResultRaw = readRequiredDataProperty(
    root,
    'releasedModelResult',
    '$.releasedModelResult',
    issues,
    'releasedModelResult',
  );
  let validatedRelease: MLBModelTestReleaseResult | undefined;
  if (releasedModelResultRaw !== undefined) {
    const releaseValidation =
      validateMLBModelTestReleaseResult(releasedModelResultRaw);
    if (!releaseValidation.ok) {
      pushCollapsedIssue(
        issues,
        releaseValidation.issues,
        'RELEASE_RESULT_INVALID',
        '$.releasedModelResult',
        'Released model result',
      );
    } else {
      validatedRelease = releaseValidation.value;
      const model = validatedRelease.fitValidation.model;
      if (!verifyMLBShadowCandidate003AuthoritativeModel(model)) {
        issues.push({
          code: 'MODEL_NOT_AUTHORITATIVE',
          path: '$.releasedModelResult.fitValidation.model',
          message:
            'Released model is not the frozen candidate-003 model',
        });
      }
    }
  }

  // 5. featureManifest: structural validation (calls odds firewall) +
  //    frozen real-pregame manifest identity (fingerprint) + optional
  //    metadata cross-checks.
  const featureManifestRaw = readRequiredDataProperty(
    root,
    'featureManifest',
    '$.featureManifest',
    issues,
    'featureManifest',
  );
  let validatedManifest: MLBFeatureManifest | undefined;
  if (featureManifestRaw !== undefined) {
    const manifestValidation = validateMLBFeatureManifest(featureManifestRaw);
    if (!manifestValidation.ok) {
      pushCollapsedIssue(
        issues,
        manifestValidation.issues,
        'MANIFEST_INVALID',
        '$.featureManifest',
        'Feature manifest',
      );
    } else {
      validatedManifest = manifestValidation.value;
      const fingerprintResult =
        computeMLBFeatureManifestFingerprint(featureManifestRaw);
      if (!fingerprintResult.ok) {
        // Defensive: manifest was just validated; this is unreachable in practice.
        pushCollapsedIssue(
          issues,
          fingerprintResult.issues,
          'MANIFEST_INVALID',
          '$.featureManifest',
          'Feature manifest',
        );
      } else if (
        fingerprintResult.fingerprint !==
        MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1_FINGERPRINT
      ) {
        issues.push({
          code: 'MANIFEST_FINGERPRINT_MISMATCH',
          path: '$.featureManifest',
          message:
            'Feature manifest does not match the frozen candidate-003 ' +
            'real-pregame manifest identity',
        });
      } else {
        if (
          featureManifestId !== null &&
          featureManifestId !== validatedManifest.manifestId
        ) {
          issues.push({
            code: 'SOURCE_IDENTITY_MISMATCH',
            path: '$.featureManifestId',
            message:
              'featureManifestId does not match manifest manifestId',
          });
        }
        if (
          featureManifestFingerprint !== null &&
          featureManifestFingerprint !== fingerprintResult.fingerprint
        ) {
          issues.push({
            code: 'MANIFEST_FINGERPRINT_MISMATCH',
            path: '$.featureManifestFingerprint',
            message:
              'featureManifestFingerprint does not match manifest fingerprint',
          });
        }
      }
    }
  }

  // 6. snapshot: structural validation only (calls odds firewall). The canonical
  //    pregame snapshot has no authoritative gamePk (it carries gameId: string),
  //    so no game identity cross-check is performed (source truth).
  const snapshotRaw = readRequiredDataProperty(
    root,
    'snapshot',
    '$.snapshot',
    issues,
    'snapshot',
  );
  let validatedSnapshot: MLBCanonicalPregameSnapshot | undefined;
  if (snapshotRaw !== undefined) {
    const snapshotValidation = validateMLBCanonicalPregameSnapshot(snapshotRaw);
    if (!snapshotValidation.ok) {
      pushCollapsedIssue(
        issues,
        snapshotValidation.issues,
        'SNAPSHOT_INVALID',
        '$.snapshot',
        'Pregame snapshot',
      );
    } else {
      validatedSnapshot = snapshotValidation.value;
    }
  }

  // 7. Fail-closed: any issue rejects the entire job.
  if (issues.length > 0) {
    return { ok: false, issues: sortIssues(issues) };
  }

  // 8. Construct a NEW immutable job (never return the caller's input object).
  //    Optional fields are canonicalized to null when omitted.
  const job: MLBShadowExecutionJobV1 = Object.freeze({
    repoRoot: requireValidated(repoRoot),
    shadowRecordId: requireValidated(shadowRecordId),
    gamePk: requireValidated(gamePk),
    predictionGeneratedAt: requireValidated(predictionGeneratedAt),
    releasedModelResult: requireValidated(validatedRelease),
    featureManifest: requireValidated(validatedManifest),
    snapshot: requireValidated(validatedSnapshot),
    officialDate,
    scheduledStartAt,
    latencyMs,
    featureManifestId,
    featureManifestFingerprint,
    timingReferenceContractVersion,
    timingReferenceCutoffAt,
  });

  return { ok: true, value: job };
}
