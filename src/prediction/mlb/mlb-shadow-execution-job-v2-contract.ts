/* -------------------------------------------------------------------------- */
/*  Additive shadow execution-job contract (L5E2V-C2 / P5C-C1)                 */
/* -------------------------------------------------------------------------- */
/**
 * Pure, side-effect-free input contract for one fully prepared S1 shadow
 * execution job — V2.
 *
 * PHASE SCOPE (this phase builds ONLY the contract + validator + tests):
 *  - V1 remains frozen and is NOT modified by this module.
 *  - No runtime adapter. No CLI. No commit. No push.
 *  - No schedule lookup. No TRAIN loading/fitting. No prediction execution.
 *  - No prediction / operational persistence. No outcome. No grading.
 *
 * DIFFERENCE FROM V1 (the existing shadow execution job contract):
 *  V1 carries a historical release-result model field.
 *  V2 replaces that seam with `authorizedModelArtifact` of type
 *  MLBShadowCandidate003AuthorizedModelArtifact. V2 validation calls
 *  validateMLBShadowCandidate003AuthorizedModelArtifact, which transitively
 *  enforces the exact Candidate-003 model fingerprint, recipe identity, TRAIN
 *  provenance, manifest provenance, and promotion evaluation authority.
 *  V2 does NOT independently reimplement any scientific gate and does NOT
 *  import the V1 release-result contract.
 *
 * This contract validates CALLER-SUPPLIED values only. It generates nothing
 * (no runtime timestamps, no randomness, no filesystem or network access).
 *
 * CONCEPTUAL FUTURE FLOW:
 *   upstream preparation  ->  MLBShadowExecutionJobV2  ->  future L5E2V adapter
 *                            (V1 path still routes through MLBShadowExecutionJobV1
 *                             -> existing L5E2U / L5E2S / L5E2Q)
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
 *
 * STABLE-RETRY INVARIANT (documentation only; no runtime hash):
 *   For the same physical logical retry attempt, the following MUST remain
 *   stable:
 *     repoRoot, shadowRecordId, gamePk, predictionGeneratedAt,
 *     authorizedModelArtifact (candidate-003 identity), featureManifest (frozen
 *     real-pregame manifest identity), snapshot (canonical pregame identity),
 *     officialDate, scheduledStartAt, latencyMs, featureManifestId,
 *     featureManifestFingerprint, timingReferenceContractVersion,
 *     timingReferenceCutoffAt.
 */

import {
  validateMLBShadowCandidate003AuthorizedModelArtifact,
  type MLBShadowCandidate003AuthorizedModelArtifact,
} from '@/prediction/mlb/mlb-shadow-candidate-003-authorized-model-artifact';
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
 * job maps 1:1 to the existing L5E2U input without requiring the future
 * adapter to strip a version field.
 */
export const MLB_SHADOW_EXECUTION_JOB_V2_CONTRACT_VERSION =
  'mlb-shadow-execution-job-v2' as const;

/* -------------------------------------------------------------------------- */
/*  Issue model                                                               */
/* -------------------------------------------------------------------------- */
/**
 * Fixed structural issue codes. Messages are fixed templates and never echo
 * raw prediction values, probabilities, model coefficients, snapshot contents,
 * raw objects, stack traces, or arbitrary error.message. Field paths are safe
 * field identity only.
 *
 * NOTE: V2 replaces V1's RELEASE_RESULT_INVALID with AUTHORIZED_ARTIFACT_INVALID
 * and does NOT carry MODEL_NOT_AUTHORITATIVE — the candidate-003 gate is
 * enforced transitively by validateMLBShadowCandidate003AuthorizedModelArtifact.
 * V2 does NOT import the historical V1 model-contract module and does NOT
 * reference its release-result type. V2 is authorization-only packaging: it
 * carries the immutable Candidate-003 artifact and does not reference
 * historical release-result types from the V1 path.
 */
export type MLBShadowExecutionJobV2IssueCode =
  | 'NOT_PLAIN_OBJECT'
  | 'UNKNOWN_FIELD'
  | 'MISSING_FIELD'
  | 'INVALID_STRING'
  | 'INVALID_INTEGER'
  | 'INVALID_TIMESTAMP'
  | 'INVALID_DATE'
  | 'INVALID_HASH'
  | 'INVALID_JSON_VALUE'
  | 'AUTHORIZED_ARTIFACT_INVALID'
  | 'MANIFEST_INVALID'
  | 'MANIFEST_FINGERPRINT_MISMATCH'
  | 'SNAPSHOT_INVALID'
  | 'ODDS_CONTAMINATION'
  | 'PROHIBITED_CONCEPT'
  | 'SOURCE_IDENTITY_MISMATCH';

export type MLBShadowExecutionJobV2ValidationIssue = Readonly<{
  code: MLBShadowExecutionJobV2IssueCode;
  path: string;
  message: string;
}>;

export type MLBShadowExecutionJobV2ValidationResult =
  | Readonly<{ ok: true; value: MLBShadowExecutionJobV2 }>
  | Readonly<{ ok: false; issues: readonly MLBShadowExecutionJobV2ValidationIssue[] }>;

/* -------------------------------------------------------------------------- */
/*  Immutable job type                                                          */
/* -------------------------------------------------------------------------- */
/**
 * One fully prepared S1 shadow execution job (V2 authorization packaging).
 *
 * Contains EXACTLY the L5E2U input values it is constructed to carry. Required
 * scalars are non-null; optional metadata is canonicalized to `null` when
 * omitted (the caller may pass undefined or null for any optional field).
 * The object is shallow-frozen (top-level readonly), matching existing
 * repository contract patterns; nested model/snapshot objects are passed
 * through as opaque validated references.
 *
 * The `authorizedModelArtifact` field carries the immutable Candidate-003
 * authorized artifact (deep-frozen singleton from getMLBShadowCandidate003AuthorizedModelArtifact).
 */
export type MLBShadowExecutionJobV2 = Readonly<{
  repoRoot: string;
  shadowRecordId: string;
  gamePk: number;
  predictionGeneratedAt: string;
  authorizedModelArtifact: MLBShadowCandidate003AuthorizedModelArtifact;
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
 *
 * NOTE: `releasedModelResult` is NOT in this set. V2 carries
 * `authorizedModelArtifact` instead, so a V1-style releasedModelResult is
 * rejected as UNKNOWN_FIELD regardless of its content.
 */
const AUTHORIZED_TOP_LEVEL_FIELDS: ReadonlySet<string> = new Set<string>([
  'repoRoot',
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
  code: MLBShadowExecutionJobV2IssueCode,
  path: string,
  message: string,
): void {
  if (!issues.some((item) => item.path === path && item.code === code)) {
    issues.push({ code, path, message });
  }
}

function sortIssues(
  issues: MLBShadowExecutionJobV2ValidationIssue[],
): readonly MLBShadowExecutionJobV2ValidationIssue[] {
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
  downstream: readonly DownstreamIssue[],
  collapsedCode: MLBShadowExecutionJobV2IssueCode,
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
  issues: MLBShadowExecutionJobV2ValidationIssue[],
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
 * Validates a fully prepared S1 shadow execution job (V2 authorization
 * packaging).
 *
 * Fail-closed: any structural or identity failure yields ok === false with a
 * fixed, safe issue list. On success, a NEW shallow-frozen immutable job is
 * returned; the caller's input object is never mutated or returned.
 *
 * The authorizedModelArtifact is validated via validateMLBShadowCandidate003AuthorizedModelArtifact,
 * which transitively enforces the exact Candidate-003 model fingerprint, recipe
 * identity, TRAIN provenance, manifest provenance, and promotion evaluation
 * authority. V2 does NOT independently reimplement those scientific gates.
 */
export function validateMLBShadowExecutionJobV2(
  input: unknown,
): MLBShadowExecutionJobV2ValidationResult {
  const issues: MLBShadowExecutionJobV2ValidationIssue[] = [];

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
  //    `releasedModelResult` is NOT authorized in V2; it is rejected as
  //    UNKNOWN_FIELD regardless of content.
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

  // 4. authorizedModelArtifact: structural + provenance validation.
  //    validateMLBShadowCandidate003AuthorizedModelArtifact transitively
  //    enforces the exact Candidate-003 model fingerprint, recipe identity,
  //    TRAIN provenance, manifest provenance, and promotion evaluation
  //    authority. V2 does not independently reimplement those gates.
  const authorizedModelArtifactRaw = readRequiredDataProperty(
    root,
    'authorizedModelArtifact',
    '$.authorizedModelArtifact',
    issues,
    'authorizedModelArtifact',
  );
  let validatedArtifact: MLBShadowCandidate003AuthorizedModelArtifact | undefined;
  if (authorizedModelArtifactRaw !== undefined) {
    const artifactValidation =
      validateMLBShadowCandidate003AuthorizedModelArtifact(
        authorizedModelArtifactRaw,
      );
    if (!artifactValidation.ok) {
      pushCollapsedIssue(
        issues,
        artifactValidation.issues,
        'AUTHORIZED_ARTIFACT_INVALID',
        '$.authorizedModelArtifact',
        'Authorized model artifact',
      );
    } else {
      validatedArtifact = artifactValidation.value;
    }
  }

  // 5. featureManifest: structural validation + frozen-identity validation +
  //    cross-field identity checks.
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
            message: 'featureManifestId does not match manifest manifestId',
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
        // V2 crosscheck: the authorized model artifact's model manifest identity
        // must be compatible with the caller-supplied featureManifestId under
        // the same frozen Candidate-003 manifest.
        if (
          validatedArtifact !== undefined &&
          featureManifestId !== null &&
          featureManifestId !== validatedArtifact.model.manifestId
        ) {
          issues.push({
            code: 'SOURCE_IDENTITY_MISMATCH',
            path: '$.featureManifestId',
            message:
              'featureManifestId does not match authorized model artifact ' +
              'manifestId',
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
  const job: MLBShadowExecutionJobV2 = Object.freeze({
    repoRoot: requireValidated(repoRoot),
    shadowRecordId: requireValidated(shadowRecordId),
    gamePk: requireValidated(gamePk),
    predictionGeneratedAt: requireValidated(predictionGeneratedAt),
    authorizedModelArtifact: requireValidated(validatedArtifact),
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
