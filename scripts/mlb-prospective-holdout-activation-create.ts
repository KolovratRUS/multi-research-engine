#!/usr/bin/env tsx
import crypto from 'node:crypto';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  validateMLBProspectiveHoldoutActivation,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  writeMLBProspectiveHoldoutActivation,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-store';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_BOUNDARY_SELECTION_POLICY_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-plan';

/* -------------------------------------------------------------------------- */
/*  Known plan keys (exact top-level public B1 PLAN)                           */
/* -------------------------------------------------------------------------- */

const KNOWN_PLAN_KEYS = new Set([
  'activationDeadlineAt',
  'activationId',
  'activationPayload',
  'boundarySelectionPolicyId',
  'candidateFingerprint',
  'candidateRecipeId',
  'contractVersion',
  'firstTestSideGamePk',
  'firstValidationGamePk',
  'inputGameCount',
  'noSmallerN',
  'planContractVersion',
  'planFingerprint',
  'planningReferenceAt',
  'prospectivelyEligibleGameCount',
  'resultIndependentSelection',
  'scheduleUniverseFingerprint',
  'stableOrderPolicy',
  'testSideAvailableCount',
  'testSideDateRule',
  'testTargetCount',
  'validationBoundaryOfficialDate',
  'validationSideAvailableCount',
  'validationSideDateRule',
  'validationTargetCount',
]);

/* -------------------------------------------------------------------------- */
/*  Host-local error domain                                                   */
/* -------------------------------------------------------------------------- */

type HostErrorKind =
  | 'INVALID_ARGUMENTS'
  | 'APPROVED_PLAN_SHA256_INVALID'
  | 'PLAN_READ_FAILURE'
  | 'APPROVED_PLAN_SHA256_MISMATCH'
  | 'INVALID_PLAN_JSON'
  | 'INVALID_PLAN_CONTRACT'
  | 'ACTIVATION_ID_MISMATCH'
  | 'PLAN_STALE'
  | 'ACTIVATION_ALREADY_EXISTS'
  | 'STORE_FAILURE';

interface HostErrorIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

interface HostError {
  readonly kind: HostErrorKind;
  readonly issues: readonly HostErrorIssue[];
}

interface ActivationCreatedReceipt {
  readonly kind: 'ACTIVATION_CREATED';
  readonly activationId: string;
  readonly approvedPlanSha256: string;
  readonly planFingerprint: string;
  readonly persistedAt: string;
  readonly activationSha256: string;
  readonly activationByteLength: number;
}

type HostResult =
  | { readonly ok: true; readonly receipt: ActivationCreatedReceipt }
  | { readonly ok: false; readonly error: HostError };

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    value.length > 0
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function pushHostIssue(
  issues: HostErrorIssue[],
  code: string,
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function sortHostIssues(
  issues: readonly HostErrorIssue[],
): readonly HostErrorIssue[] {
  return Object.freeze(
    issues
      .slice()
      .sort((a, b) => (a.path < b.path ? -1 : a.path === b.path ? 0 : 1)
        || (a.code < b.code ? -1 : a.code === b.code ? 0 : 1))
      .filter((item, index, array) =>
        index === 0 || item.path !== array[index - 1].path || item.code !== array[index - 1].code,
      ),
  );
}

function isRFC3339Timestamp(value: string): boolean {
  return RFC3339_PATTERN.test(value);
}

function parseTimestampToMs(value: unknown): number {
  if (typeof value !== 'string') {
    return NaN;
  }
  const trimmed = value.trim();
  if (trimmed !== value || trimmed.length === 0) {
    return NaN;
  }
  if (!isRFC3339Timestamp(trimmed)) {
    return NaN;
  }
  const ms = Date.parse(trimmed);
  return Number.isFinite(ms) ? ms : NaN;
}

function isOfficialDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseOfficialDate(value: unknown): { ok: false; path: string; message: string } | { ok: true; date: string } {
  if (!isOfficialDate(value)) {
    return { ok: false, path: '$.validationBoundaryOfficialDate', message: 'Must be YYYY-MM-DD' };
  }
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (
    Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day) ||
    month < 1 || month > 12 ||
    day < 1 || day > daysInMonth[month - 1] + (month === 2 && leap ? 1 : 0)
  ) {
    return { ok: false, path: '$.validationBoundaryOfficialDate', message: 'Must be a valid Gregorian date' };
  }
  return { ok: true, date: value };
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isSHA256(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value) && value === value.trim();
}

/* -------------------------------------------------------------------------- */
/*  Core host logic                                                           */
/* -------------------------------------------------------------------------- */

export async function runMLBProspectiveHoldoutActivationCreate(
  planFilePath: string,
  approvedPlanSha256: string,
  deps: {
    readonly readFile: (path: string) => Promise<Buffer>;
    readonly now: () => Date;
    readonly writeActivation: (
      repositoryRoot: string,
      proposedActivation: unknown,
      clock: () => string,
    ) => Promise<unknown>;
    readonly repositoryRoot?: string;
  } = {
    readFile: (filePath) => fs.readFile(filePath),
    now: () => new Date(),
    writeActivation: (repositoryRoot, proposedActivation, clock) =>
      writeMLBProspectiveHoldoutActivation(repositoryRoot, proposedActivation, clock),
  },
): Promise<HostResult> {
  const issues: HostErrorIssue[] = [];

  // 1. Validate arguments (already validated at CLI level, but host enforces)
  if (!isStrictNonEmptyTrimmedString(planFilePath)) {
    return { ok: false, error: { kind: 'INVALID_ARGUMENTS', issues: sortHostIssues([{ code: 'EMPTY_PLAN_PATH', path: '$.planFilePath', message: 'planFilePath must be a non-empty trimmed string' }]) } };
  }

  // 2. Validate approved SHA256 format
  if (!isSHA256(approvedPlanSha256)) {
    return { ok: false, error: { kind: 'APPROVED_PLAN_SHA256_INVALID', issues: sortHostIssues([{ code: 'INVALID_SHA256', path: '$.approvedPlanSha256', message: 'approvedPlanSha256 must be exactly 64 lowercase hex characters' }]) } };
  }

  // 3. Read plan file bytes ONCE
  let planBytes: Buffer;
  try {
    planBytes = Buffer.from(await deps.readFile(planFilePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown read error';
    return { ok: false, error: { kind: 'PLAN_READ_FAILURE', issues: sortHostIssues([{ code: 'READ_FAILED', path: '$.planFilePath', message }]) } };
  }

  // 4. SHA256 those exact bytes
  const actualSha256 = crypto.createHash('sha256').update(planBytes).digest('hex');

  // 5. Compare with externally supplied approved SHA
  if (actualSha256 !== approvedPlanSha256) {
    return { ok: false, error: { kind: 'APPROVED_PLAN_SHA256_MISMATCH', issues: sortHostIssues([{ code: 'SHA256_MISMATCH', path: '$.approvedPlanSha256', message: 'Approved SHA256 does not match plan file bytes' }]) } };
  }

  // 6. Reject mismatch BEFORE JSON parse (already done above)

  // 7. Parse the SAME in-memory bytes
  let parsed: unknown;
  try {
    parsed = JSON.parse(planBytes.toString('utf-8'));
  } catch {
    return { ok: false, error: { kind: 'INVALID_PLAN_JSON', issues: sortHostIssues([{ code: 'INVALID_JSON', path: '$.planFile', message: 'Plan file contains invalid JSON' }]) } };
  }

  // 8. never reread plan file (we haven't)

  // 9. Validate plan envelope
  if (!isPlainObject(parsed)) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'NOT_PLAIN_OBJECT', path: '$', message: 'Plan must be a plain JSON object' }]) } };
  }

  const plan = parsed as Record<string, unknown>;

  // 10. Reject persistedAt at top level (specific prohibited field before general unknown-key check)
  if (Object.hasOwn(plan, 'persistedAt')) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'PROHIBITED_FIELD', path: '$.persistedAt', message: 'persistedAt is owned by the store, not the plan' }]) } };
  }

  // 11. Reject unknown top-level keys
  for (const key of Object.getOwnPropertyNames(plan)) {
    if (!KNOWN_PLAN_KEYS.has(key)) {
      return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'UNKNOWN_FIELD', path: `$.${key}`, message: `Unknown top-level plan field: ${key}` }]) } };
    }
  }

  // Helper for required string fields
  function requireString(
    issues: HostErrorIssue[],
    value: unknown,
    key: string,
    path: string,
  ): boolean {
    if (!isStrictNonEmptyTrimmedString(value)) {
      pushHostIssue(issues, 'MISSING_FIELD', path, `${key} is required and must be a non-empty trimmed string`);
      return false;
    }
    return true;
  }

  // Helper for finite timestamp
  function requireTimestamp(
    issues: HostErrorIssue[],
    value: unknown,
    key: string,
    path: string,
  ): boolean {
    if (!isStrictNonEmptyTrimmedString(value) || !isRFC3339Timestamp(value) || Number.isNaN(parseTimestampToMs(value))) {
      pushHostIssue(issues, 'INVALID_TIMESTAMP', path, `${key} must be a valid finite RFC3339 timestamp`);
      return false;
    }
    return true;
  }

  // Helper for non-negative integer
  function requireNonNegativeInteger(
    issues: HostErrorIssue[],
    value: unknown,
    key: string,
    path: string,
  ): boolean {
    if (!isSafeInteger(value) || value < 0) {
      pushHostIssue(issues, 'INVALID_INTEGER', path, `${key} must be a non-negative integer`);
      return false;
    }
    return true;
  }

  // Helper for positive integer
  function requirePositiveInteger(
    issues: HostErrorIssue[],
    value: unknown,
    key: string,
    path: string,
  ): boolean {
    if (!isSafeInteger(value) || value <= 0) {
      pushHostIssue(issues, 'INVALID_INTEGER', path, `${key} must be a positive integer`);
      return false;
    }
    return true;
  }

  // contractVersion
  if (!requireString(issues, plan.contractVersion, 'contractVersion', '$.contractVersion')) return failInvalidContract(issues);
  if (plan.contractVersion !== MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION) {
    pushHostIssue(issues, 'IDENTITY_MISMATCH', '$.contractVersion', 'contractVersion does not match frozen plan');
  }

  // planContractVersion
  if (!requireString(issues, plan.planContractVersion, 'planContractVersion', '$.planContractVersion')) return failInvalidContract(issues);
  if (plan.planContractVersion !== MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION) {
    pushHostIssue(issues, 'IDENTITY_MISMATCH', '$.planContractVersion', 'planContractVersion does not match frozen plan');
  }

  // Both must equal
  if (plan.contractVersion !== plan.planContractVersion) {
    pushHostIssue(issues, 'IDENTITY_MISMATCH', '$.contractVersion', 'contractVersion must equal planContractVersion');
  }

  // boundarySelectionPolicyId
  if (!requireString(issues, plan.boundarySelectionPolicyId, 'boundarySelectionPolicyId', '$.boundarySelectionPolicyId')) return failInvalidContract(issues);
  if (plan.boundarySelectionPolicyId !== MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_BOUNDARY_SELECTION_POLICY_ID) {
    pushHostIssue(issues, 'IDENTITY_MISMATCH', '$.boundarySelectionPolicyId', 'boundarySelectionPolicyId does not match frozen value');
  }

  // activationId
  if (!requireString(issues, plan.activationId, 'activationId', '$.activationId')) return failInvalidContract(issues);

  // planningReferenceAt
  if (!requireTimestamp(issues, plan.planningReferenceAt, 'planningReferenceAt', '$.planningReferenceAt')) return failInvalidContract(issues);

  // validationBoundaryOfficialDate
  if (!isOfficialDate(plan.validationBoundaryOfficialDate)) {
    pushHostIssue(issues, 'INVALID_DATE', '$.validationBoundaryOfficialDate', 'validationBoundaryOfficialDate must be YYYY-MM-DD');
  } else {
    const dateResult = parseOfficialDate(plan.validationBoundaryOfficialDate);
    if (!dateResult.ok) {
      pushHostIssue(issues, 'INVALID_DATE', '$.validationBoundaryOfficialDate', dateResult.message);
    }
  }

  // activationDeadlineAt
  if (!requireTimestamp(issues, plan.activationDeadlineAt, 'activationDeadlineAt', '$.activationDeadlineAt')) return failInvalidContract(issues);

  // inputGameCount
  if (!requireNonNegativeInteger(issues, plan.inputGameCount, 'inputGameCount', '$.inputGameCount')) return failInvalidContract(issues);

  // prospectivelyEligibleGameCount
  if (!requireNonNegativeInteger(issues, plan.prospectivelyEligibleGameCount, 'prospectivelyEligibleGameCount', '$.prospectivelyEligibleGameCount')) return failInvalidContract(issues);

  // validationSideAvailableCount
  if (!requireNonNegativeInteger(issues, plan.validationSideAvailableCount, 'validationSideAvailableCount', '$.validationSideAvailableCount')) return failInvalidContract(issues);

  // testSideAvailableCount
  if (!requireNonNegativeInteger(issues, plan.testSideAvailableCount, 'testSideAvailableCount', '$.testSideAvailableCount')) return failInvalidContract(issues);

  // validationTargetCount
  if (!requirePositiveInteger(issues, plan.validationTargetCount, 'validationTargetCount', '$.validationTargetCount')) return failInvalidContract(issues);

  // testTargetCount
  if (!requirePositiveInteger(issues, plan.testTargetCount, 'testTargetCount', '$.testTargetCount')) return failInvalidContract(issues);

  // scheduleUniverseFingerprint
  if (!requireString(issues, plan.scheduleUniverseFingerprint, 'scheduleUniverseFingerprint', '$.scheduleUniverseFingerprint')) return failInvalidContract(issues);
  if (!isSHA256(plan.scheduleUniverseFingerprint)) {
    pushHostIssue(issues, 'INVALID_FINGERPRINT', '$.scheduleUniverseFingerprint', 'scheduleUniverseFingerprint must be a valid SHA256 hex string');
  }

  // activationPayload
  let activationPayload: Record<string, unknown> | null = null;
  if (!isPlainObject(plan.activationPayload)) {
    pushHostIssue(issues, 'INVALID_OBJECT', '$.activationPayload', 'activationPayload must be a non-null object');
  } else {
    activationPayload = plan.activationPayload as Record<string, unknown>;
  }

  // planFingerprint
  if (!requireString(issues, plan.planFingerprint, 'planFingerprint', '$.planFingerprint')) return failInvalidContract(issues);
  if (!isSHA256(plan.planFingerprint)) {
    pushHostIssue(issues, 'INVALID_FINGERPRINT', '$.planFingerprint', 'planFingerprint must be a valid SHA256 hex string');
  }

  // firstValidationGamePk
  if (!isSafeInteger(plan.firstValidationGamePk) || plan.firstValidationGamePk <= 0) {
    pushHostIssue(issues, 'INVALID_GAME_PK', '$.firstValidationGamePk', 'firstValidationGamePk must be a positive integer');
  }

  // firstTestSideGamePk
  if (!isSafeInteger(plan.firstTestSideGamePk) || plan.firstTestSideGamePk <= 0) {
    pushHostIssue(issues, 'INVALID_GAME_PK', '$.firstTestSideGamePk', 'firstTestSideGamePk must be a positive integer');
  }

  // stableOrderPolicy
  if (!requireString(issues, plan.stableOrderPolicy, 'stableOrderPolicy', '$.stableOrderPolicy')) return failInvalidContract(issues);
  if (plan.stableOrderPolicy !== MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY) {
    pushHostIssue(issues, 'IDENTITY_MISMATCH', '$.stableOrderPolicy', 'stableOrderPolicy does not match frozen value');
  }

  // validationSideDateRule
  if (!requireString(issues, plan.validationSideDateRule, 'validationSideDateRule', '$.validationSideDateRule')) return failInvalidContract(issues);
  if (plan.validationSideDateRule !== MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE) {
    pushHostIssue(issues, 'IDENTITY_MISMATCH', '$.validationSideDateRule', 'validationSideDateRule does not match frozen value');
  }

  // testSideDateRule
  if (!requireString(issues, plan.testSideDateRule, 'testSideDateRule', '$.testSideDateRule')) return failInvalidContract(issues);
  if (plan.testSideDateRule !== MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE) {
    pushHostIssue(issues, 'IDENTITY_MISMATCH', '$.testSideDateRule', 'testSideDateRule does not match frozen value');
  }

  // noSmallerN
  if (plan.noSmallerN !== true) {
    pushHostIssue(issues, 'INVALID_BOOLEAN', '$.noSmallerN', 'noSmallerN must be true');
  }

  // resultIndependentSelection
  if (plan.resultIndependentSelection !== true) {
    pushHostIssue(issues, 'INVALID_BOOLEAN', '$.resultIndependentSelection', 'resultIndependentSelection must be true');
  }

  // candidateRecipeId
  if (!requireString(issues, plan.candidateRecipeId, 'candidateRecipeId', '$.candidateRecipeId')) return failInvalidContract(issues);

  // candidateFingerprint
  if (!requireString(issues, plan.candidateFingerprint, 'candidateFingerprint', '$.candidateFingerprint')) return failInvalidContract(issues);
  if (!isSHA256(plan.candidateFingerprint)) {
    pushHostIssue(issues, 'INVALID_FINGERPRINT', '$.candidateFingerprint', 'candidateFingerprint must be a valid SHA256 hex string');
  }

  if (issues.length > 0) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues(issues) } };
  }

  // 13. Static plan sanity relations — cast after validation
  const inputGameCount = plan.inputGameCount as number;
  const prospectivelyEligibleGameCount = plan.prospectivelyEligibleGameCount as number;
  const validationSideAvailableCount = plan.validationSideAvailableCount as number;
  const validationTargetCount = plan.validationTargetCount as number;
  const testSideAvailableCount = plan.testSideAvailableCount as number;
  const testTargetCount = plan.testTargetCount as number;
  const noSmallerN = plan.noSmallerN as boolean;
  const resultIndependentSelection = plan.resultIndependentSelection as boolean;
  const firstValidationGamePk = plan.firstValidationGamePk as number | null;
  const firstTestSideGamePk = plan.firstTestSideGamePk as number | null;

  if (inputGameCount < prospectivelyEligibleGameCount) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'INVALID_RELATION', path: '$.inputGameCount', message: 'inputGameCount must be >= prospectivelyEligibleGameCount' }]) } };
  }
  if (validationSideAvailableCount < validationTargetCount) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'INVALID_RELATION', path: '$.validationSideAvailableCount', message: 'validationSideAvailableCount must be >= validationTargetCount' }]) } };
  }
  if (testSideAvailableCount < testTargetCount) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'INVALID_RELATION', path: '$.testSideAvailableCount', message: 'testSideAvailableCount must be >= testTargetCount' }]) } };
  }
  if (validationTargetCount !== 67) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'INVALID_FROZEN_COUNT', path: '$.validationTargetCount', message: 'validationTargetCount must be exactly 67' }]) } };
  }
  if (testTargetCount !== 69) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'INVALID_FROZEN_COUNT', path: '$.testTargetCount', message: 'testTargetCount must be exactly 69' }]) } };
  }
  if (noSmallerN !== true) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'INVALID_BOOLEAN', path: '$.noSmallerN', message: 'noSmallerN must be true' }]) } };
  }
  if (resultIndependentSelection !== true) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'INVALID_BOOLEAN', path: '$.resultIndependentSelection', message: 'resultIndependentSelection must be true' }]) } };
  }
  if (firstValidationGamePk === firstTestSideGamePk) {
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'INVALID_GAME_PK', path: '$.firstValidationGamePk', message: 'firstValidationGamePk must not equal firstTestSideGamePk' }]) } };
  }

  // 14. Activation payload validation
  const payloadValidation = validateMLBProspectiveHoldoutActivation(activationPayload);
  if (!payloadValidation.ok) {
    const mappedIssues: HostErrorIssue[] = payloadValidation.issues.map((issue) => ({
      code: issue.code,
      path: issue.path,
      message: issue.message,
    }));
    return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues(mappedIssues) } };
  }

  if (activationPayload === null) {
    return failInvalidContract(issues);
  }
  const safeActivationPayload = activationPayload;

  // 15. Duplicated plan ↔ payload consistency
  const duplicatedFields: Array<{
    planKey: string;
    payloadKey: string;
    mismatchKind: HostErrorKind;
  }> = [
    { planKey: 'activationId', payloadKey: 'activationId', mismatchKind: 'ACTIVATION_ID_MISMATCH' },
    { planKey: 'candidateRecipeId', payloadKey: 'candidateRecipeId', mismatchKind: 'INVALID_PLAN_CONTRACT' },
    { planKey: 'candidateFingerprint', payloadKey: 'candidateFingerprint', mismatchKind: 'INVALID_PLAN_CONTRACT' },
    { planKey: 'validationBoundaryOfficialDate', payloadKey: 'validationBoundaryOfficialDate', mismatchKind: 'INVALID_PLAN_CONTRACT' },
    { planKey: 'validationTargetCount', payloadKey: 'validationTargetCount', mismatchKind: 'INVALID_PLAN_CONTRACT' },
    { planKey: 'testTargetCount', payloadKey: 'testTargetCount', mismatchKind: 'INVALID_PLAN_CONTRACT' },
    { planKey: 'stableOrderPolicy', payloadKey: 'stableOrderPolicy', mismatchKind: 'INVALID_PLAN_CONTRACT' },
    { planKey: 'validationSideDateRule', payloadKey: 'validationSideDateRule', mismatchKind: 'INVALID_PLAN_CONTRACT' },
    { planKey: 'testSideDateRule', payloadKey: 'testSideDateRule', mismatchKind: 'INVALID_PLAN_CONTRACT' },
    { planKey: 'noSmallerN', payloadKey: 'noSmallerN', mismatchKind: 'INVALID_PLAN_CONTRACT' },
    { planKey: 'resultIndependentSelection', payloadKey: 'resultIndependentSelection', mismatchKind: 'INVALID_PLAN_CONTRACT' },
  ];

  for (const field of duplicatedFields) {
    const planValue = plan[field.planKey];
    const payloadValue = safeActivationPayload[field.payloadKey];
    if (planValue !== payloadValue) {
      if (field.mismatchKind === 'ACTIVATION_ID_MISMATCH') {
        return { ok: false, error: { kind: 'ACTIVATION_ID_MISMATCH', issues: sortHostIssues([{ code: 'MISMATCH', path: `$.${field.planKey}`, message: `Plan and payload ${field.planKey} differ` }]) } };
      }
      return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues([{ code: 'MISMATCH', path: `$.${field.planKey}`, message: `Plan and payload ${field.planKey} differ` }]) } };
    }
  }

  // 18. Trusted time — sample EXACTLY ONCE after every static plan check succeeds
  const trustedActivationAt = deps.now();
  if (!Number.isFinite(trustedActivationAt.getTime())) {
    return { ok: false, error: { kind: 'PLAN_STALE', issues: sortHostIssues([{ code: 'INVALID_NOW', path: '$.now', message: 'Sampled trusted clock is not finite' }]) } };
  }

  // 19. Strict activation deadline
  const deadlineMs = parseTimestampToMs(plan.activationDeadlineAt);
  const trustedMs = trustedActivationAt.getTime();
  if (Number.isNaN(deadlineMs) || trustedMs >= deadlineMs) {
    return { ok: false, error: { kind: 'PLAN_STALE', issues: sortHostIssues([{ code: 'PAST_DEADLINE', path: '$.activationDeadlineAt', message: 'Activation deadline has passed' }]) } };
  }

  // 20. Prepare payload unchanged — add persistedAt via store's clock seam
  const persistedPayload: Record<string, unknown> = { ...safeActivationPayload };

  // 21. Production store root — no public override
  const repositoryRoot = deps.repositoryRoot ??
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

  // 22. Write-once authority
  const rawWriteResult = await deps.writeActivation(repositoryRoot, persistedPayload, () => trustedActivationAt.toISOString());

  if (!isPlainObject(rawWriteResult)) {
    return { ok: false, error: { kind: 'STORE_FAILURE', issues: sortHostIssues([{ code: 'INVALID_STORE_RESULT', path: '$.writeActivation', message: 'Store returned non-object' }]) } };
  }

  const rawOk = (rawWriteResult as Record<string, unknown>).ok;
  if (typeof rawOk !== 'boolean') {
    return { ok: false, error: { kind: 'STORE_FAILURE', issues: sortHostIssues([{ code: 'INVALID_STORE_RESULT', path: '$.writeActivation.ok', message: 'Store result missing boolean ok' }]) } };
  }

  const writeResult = rawWriteResult as
    | { ok: true; receipt: Record<string, unknown> }
    | { ok: false; issues: readonly HostErrorIssue[] };

  if (!writeResult.ok) {
    const storeIssues = (writeResult as { ok: false; issues: readonly HostErrorIssue[] }).issues;
    if (!Array.isArray(storeIssues)) {
      return { ok: false, error: { kind: 'STORE_FAILURE', issues: sortHostIssues([{ code: 'INVALID_STORE_RESULT', path: '$.writeActivation.issues', message: 'Store failure missing issues array' }]) } };
    }
    let kind: HostErrorKind = 'STORE_FAILURE';
    if (storeIssues.some((i) => i.code === 'ACTIVATION_ALREADY_EXISTS')) {
      kind = 'ACTIVATION_ALREADY_EXISTS';
    }
    return { ok: false, error: { kind, issues: sortHostIssues([...storeIssues]) } };
  }

  const rawReceipt = (writeResult as { ok: true; receipt: unknown }).receipt;
  if (
    !isPlainObject(rawReceipt) ||
    typeof (rawReceipt as Record<string, unknown>).sha256 !== 'string' ||
    typeof (rawReceipt as Record<string, unknown>).byteLength !== 'number' ||
    typeof (rawReceipt as Record<string, unknown>).persistedAt !== 'string'
  ) {
    return { ok: false, error: { kind: 'STORE_FAILURE', issues: sortHostIssues([{ code: 'INVALID_STORE_RESULT', path: '$.writeActivation.receipt', message: 'Store success missing valid receipt' }]) } };
  }

  const receipt = rawReceipt as {
    readonly sha256: string;
    readonly byteLength: number;
    readonly persistedAt: string;
  };

  // 27. Success result
  const successReceipt: ActivationCreatedReceipt = {
    kind: 'ACTIVATION_CREATED',
    activationId: plan.activationId as string,
    approvedPlanSha256: actualSha256,
    planFingerprint: plan.planFingerprint as string,
    persistedAt: receipt.persistedAt,
    activationSha256: receipt.sha256,
    activationByteLength: receipt.byteLength,
  };

  return { ok: true, receipt: successReceipt };
}

function failInvalidContract(issues: HostErrorIssue[]): HostResult {
  return { ok: false, error: { kind: 'INVALID_PLAN_CONTRACT', issues: sortHostIssues(issues) } };
}

/* -------------------------------------------------------------------------- */
/*  CLI argument parsing                                                       */
/* -------------------------------------------------------------------------- */

interface CreateCLIIO {
  readonly stdout: (message: string) => void;
  readonly stderr: (message: string) => void;
}

function parseArguments(argv: string[]): { planFilePath: string; approvedPlanSha256: string } {
  if (argv.length !== 2) {
    throw new Error('Exactly two positional arguments are required: <reviewed-plan-file> <approved-plan-sha256>');
  }
  const [planFilePath, approvedPlanSha256] = argv;
  if (typeof planFilePath !== 'string' || planFilePath.length === 0) {
    throw new Error('planFilePath must be a non-empty string');
  }
  if (typeof approvedPlanSha256 !== 'string' || approvedPlanSha256.length === 0) {
    throw new Error('approvedPlanSha256 must be a non-empty string');
  }
  return { planFilePath, approvedPlanSha256 };
}

export async function runMLBProspectiveHoldoutActivationCreateCLI(
  argv: readonly string[],
  io?: CreateCLIIO,
  deps?: Parameters<typeof runMLBProspectiveHoldoutActivationCreate>[2],
): Promise<number> {
  const stdout = io?.stdout ?? ((message: string) => process.stdout.write(`${message}\n`));
  const stderr = io?.stderr ?? ((message: string) => process.stderr.write(`${message}\n`));

  let args: { planFilePath: string; approvedPlanSha256: string };
  try {
    args = parseArguments(argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid arguments';
    stderr(JSON.stringify({ kind: 'INVALID_ARGUMENTS', issues: [{ code: 'INVALID_ARGUMENTS', path: '$', message }] }));
    return 1;
  }

  try {
    const result = await runMLBProspectiveHoldoutActivationCreate(
      args.planFilePath,
      args.approvedPlanSha256,
      deps,
    );

    if (result.ok) {
      stdout(JSON.stringify(result.receipt));
      return 0;
    }
    stderr(JSON.stringify(result.error));
    return 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unexpected failure';
    stderr(JSON.stringify({ kind: 'STORE_FAILURE', issues: [{ code: 'UNEXPECTED_ERROR', path: '$', message }] }));
    return 1;
  }
}

/* -------------------------------------------------------------------------- */
/*  Direct execution guard                                                    */
/* -------------------------------------------------------------------------- */

function isDirectExecution(): boolean {
  const entryPoint = process.argv[1];
  if (!entryPoint) {
    return false;
  }
  try {
    const thisFile = realpathSync(fileURLToPath(import.meta.url));
    const resolvedEntry = realpathSync(entryPoint);
    return thisFile === resolvedEntry;
  } catch {
    return false;
  }
}

if (isDirectExecution()) {
  (async () => {
    process.exitCode = await runMLBProspectiveHoldoutActivationCreateCLI(process.argv);
  })();
}
