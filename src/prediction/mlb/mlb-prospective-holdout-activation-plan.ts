import crypto from 'node:crypto';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
  validateMLBProspectiveHoldoutActivation,
  type MLBProspectiveHoldoutActivation,
} from './mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
  MLB_PROSPECTIVE_HOLDOUT_SCI_CUTOFF_MINUTES,
} from './mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  computeScientificCutoffAt,
} from './mlb-prospective-t360-capture-contract';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
} from './mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
} from './mlb-prospective-holdout-game-identity-binding-contract';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from './mlb-inner-development-third-real-candidate-recipe';
import type { MLBScheduleGame } from '@/lib/research-data/types';

/* -------------------------------------------------------------------------- */
/*  Contract versions                                                         */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION =
  'mlb-prospective-holdout-activation-plan-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_BOUNDARY_SELECTION_POLICY_ID =
  'earliest-official-date-supporting-frozen-target-counts-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutActivationPlanIssue = Readonly<{
  code:
    | 'INVALID_ACTIVATION_ID'
    | 'INVALID_PLANNING_REFERENCE_AT'
    | 'INVALID_SCHEDULE_GAME_PK'
    | 'INVALID_OFFICIAL_DATE'
    | 'INVALID_SCHEDULED_START'
    | 'DUPLICATE_GAME_PK'
    | 'INSUFFICIENT_VALIDATION_CANDIDATES'
    | 'INSUFFICIENT_TEST_CANDIDATES'
    | 'NO_FEASIBLE_BOUNDARY'
    | 'PLAN_ALREADY_STALE'
    | 'ACTIVATION_CONTRACT_INVALID';
  path: string;
  message: string;
}>;

export type MLBProspectiveHoldoutActivationPlan = Readonly<{
  planContractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION;
  boundarySelectionPolicyId: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_BOUNDARY_SELECTION_POLICY_ID;
  activationId: string;
  planningReferenceAt: string;
  validationBoundaryOfficialDate: string;
  activationDeadlineAt: string;
  inputGameCount: number;
  prospectivelyEligibleGameCount: number;
  validationSideAvailableCount: number;
  testSideAvailableCount: number;
  validationTargetCount: 67;
  testTargetCount: 69;
  stableOrderPolicy: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY;
  validationSideDateRule: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE;
  testSideDateRule: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE;
  noSmallerN: true;
  resultIndependentSelection: true;
  candidateRecipeId: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID;
  candidateFingerprint: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT;
  scheduleUniverseFingerprint: string;
  activationPayload: MLBProspectiveHoldoutActivation;
  firstValidationGamePk: number | null;
  firstTestSideGamePk: number | null;
  contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION;
  planFingerprint: string;
}>;

export type MLBProspectiveHoldoutActivationPlanSuccess = Readonly<{
  ok: true;
  plan: MLBProspectiveHoldoutActivationPlan;
}>;

export type MLBProspectiveHoldoutActivationPlanFailure = Readonly<{
  ok: false;
  issues: readonly MLBProspectiveHoldoutActivationPlanIssue[];
}>;

export type MLBProspectiveHoldoutActivationPlanResult =
  | MLBProspectiveHoldoutActivationPlanSuccess
  | MLBProspectiveHoldoutActivationPlanFailure;

export type MLBProspectiveHoldoutActivationPlanInput = Readonly<{
  activationId: string;
  planningReferenceAt: string;
  scheduleGames: readonly MLBScheduleGame[];
}>;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F]/;

function isStrictNonEmptyTrimmedString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value === value.trim() &&
    !CONTROL_CHARACTER_PATTERN.test(value)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

function pushPlanIssue(
  issues: MLBProspectiveHoldoutActivationPlanIssue[],
  code: MLBProspectiveHoldoutActivationPlanIssue['code'],
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function sortPlanIssues(
  issues: MLBProspectiveHoldoutActivationPlanIssue[],
): readonly MLBProspectiveHoldoutActivationPlanIssue[] {
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

const RFC3339_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

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

/* -------------------------------------------------------------------------- */
/*  Canonical serialization                                                   */
/* -------------------------------------------------------------------------- */

function sortObjectKeys(value: Record<string, unknown>): Record<string, unknown> {
  const keys = Object.getOwnPropertyNames(value).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of keys) {
    sorted[key] = sortValue(value[key]);
  }
  return sorted;
}

function sortValue(value: unknown): unknown {
  if (isPlainObject(value)) {
    return sortObjectKeys(value);
  }
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

/* -------------------------------------------------------------------------- */
/*  Planning core                                                             */
/* -------------------------------------------------------------------------- */

export function planMLBProspectiveHoldoutActivation(
  input: MLBProspectiveHoldoutActivationPlanInput,
): MLBProspectiveHoldoutActivationPlanResult {
  const issues: MLBProspectiveHoldoutActivationPlanIssue[] = [];

  // 1. Validate activationId
  if (!isStrictNonEmptyTrimmedString(input.activationId)) {
    pushPlanIssue(issues, 'INVALID_ACTIVATION_ID', '$.activationId', 'activationId must be a non-empty trimmed string');
  }

  // 2. Validate planningReferenceAt
  const planningReferenceAt = input.planningReferenceAt;
  if (!isStrictNonEmptyTrimmedString(planningReferenceAt) || !isRFC3339Timestamp(planningReferenceAt)) {
    pushPlanIssue(issues, 'INVALID_PLANNING_REFERENCE_AT', '$.planningReferenceAt', 'planningReferenceAt must be a valid RFC3339 timestamp');
  }
  const planningReferenceMs = parseTimestampToMs(planningReferenceAt);
  if (!Number.isFinite(planningReferenceMs)) {
    pushPlanIssue(issues, 'INVALID_PLANNING_REFERENCE_AT', '$.planningReferenceAt', 'planningReferenceAt is not a valid timestamp');
  }

  // 3. Validate scheduleGames shape
  if (!Array.isArray(input.scheduleGames)) {
    pushPlanIssue(issues, 'INVALID_SCHEDULED_START', '$.scheduleGames', 'scheduleGames must be an array');
    return { ok: false, issues: sortPlanIssues(issues) };
  }

  // 4. Validate each game and detect duplicates
  const gamePkSet = new Set<number>();
  const gameRecords: Array<{
    gamePk: number;
    officialDate: string;
    scheduledStartAt: string;
    scientificCutoffAt: string;
  }> = [];

  for (let i = 0; i < input.scheduleGames.length; i++) {
    const rawGame = input.scheduleGames[i];
    const prefix = `$.scheduleGames[${i}]`;

    if (!isPlainObject(rawGame)) {
      pushPlanIssue(issues, 'INVALID_SCHEDULED_START', prefix, 'Expected plain object');
      continue;
    }

    const game = rawGame as Record<string, unknown>;

    const gamePkRaw = game.gamePk;
    if (typeof gamePkRaw !== 'number' || !Number.isSafeInteger(gamePkRaw) || gamePkRaw <= 0) {
      pushPlanIssue(issues, 'INVALID_SCHEDULE_GAME_PK', `${prefix}.gamePk`, 'gamePk must be a positive safe integer');
      continue;
    }
    const gamePk = gamePkRaw as number;
    if (gamePkSet.has(gamePk)) {
      pushPlanIssue(issues, 'DUPLICATE_GAME_PK', `${prefix}.gamePk`, `Duplicate gamePk: ${gamePk}`);
      continue;
    }
    gamePkSet.add(gamePk);

    const officialDateRaw = game.officialDate;
    if (typeof officialDateRaw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(officialDateRaw)) {
      pushPlanIssue(issues, 'INVALID_OFFICIAL_DATE', `${prefix}.officialDate`, 'officialDate must be YYYY-MM-DD');
      continue;
    }
    const [yearStr, monthStr, dayStr] = officialDateRaw.split('-');
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
      pushPlanIssue(issues, 'INVALID_OFFICIAL_DATE', `${prefix}.officialDate`, 'Must be a valid Gregorian date');
      continue;
    }

    const startTimeUtcRaw = game.startTimeUtc;
    if (!(startTimeUtcRaw instanceof Date) || Number.isNaN(startTimeUtcRaw.getTime())) {
      pushPlanIssue(issues, 'INVALID_SCHEDULED_START', `${prefix}.startTimeUtc`, 'startTimeUtc must be a valid Date');
      continue;
    }
    const scheduledStartAt = startTimeUtcRaw.toISOString();

    const cutoffResult = computeScientificCutoffAt(scheduledStartAt);
    if (!cutoffResult.ok) {
      pushPlanIssue(issues, 'INVALID_SCHEDULED_START', `${prefix}.startTimeUtc`, `Failed to compute scientific cutoff: ${cutoffResult.message}`);
      continue;
    }

    gameRecords.push({
      gamePk,
      officialDate: officialDateRaw,
      scheduledStartAt,
      scientificCutoffAt: cutoffResult.scientificCutoffAt,
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues: sortPlanIssues(issues) };
  }

  // 5. Filter prospectively eligible games
  const eligibleGames = gameRecords.filter((game) => {
    const cutoffMs = Date.parse(game.scientificCutoffAt);
    return Number.isFinite(cutoffMs) && planningReferenceMs < cutoffMs;
  });

  // 6. Stable sort eligible games
  eligibleGames.sort((a, b) => {
    const startDiff = a.scheduledStartAt.localeCompare(b.scheduledStartAt);
    if (startDiff !== 0) return startDiff;
    if (a.gamePk < b.gamePk) return -1;
    if (a.gamePk > b.gamePk) return 1;
    return 0;
  });

  const inputGameCount = input.scheduleGames.length;
  const prospectivelyEligibleGameCount = eligibleGames.length;

  // 7. Boundary selection
  const dateCounts = new Map<string, number>();
  for (const game of eligibleGames) {
    dateCounts.set(game.officialDate, (dateCounts.get(game.officialDate) ?? 0) + 1);
  }
  const uniqueDates = Array.from(dateCounts.keys()).sort();

  let validationBoundaryOfficialDate: string | null = null;
  let maxValidationCount = 0;
  let maxTestCount = 0;

  for (const boundaryDate of uniqueDates) {
    let validationCount = 0;
    let testCount = 0;
    for (const game of eligibleGames) {
      if (game.officialDate <= boundaryDate) {
        validationCount++;
      } else {
        testCount++;
      }
    }
    if (validationCount > maxValidationCount) maxValidationCount = validationCount;
    if (testCount > maxTestCount) maxTestCount = testCount;

    if (validationCount >= 67 && testCount >= 69) {
      validationBoundaryOfficialDate = boundaryDate;
      break;
    }
  }

  if (validationBoundaryOfficialDate === null) {
    if (maxValidationCount < 67) {
      return {
        ok: false,
        issues: sortPlanIssues([
          ...issues,
          { code: 'INSUFFICIENT_VALIDATION_CANDIDATES', path: '$.scheduleGames', message: `Max validation candidates: ${maxValidationCount}` },
        ]),
      };
    }
    if (maxTestCount < 69) {
      return {
        ok: false,
        issues: sortPlanIssues([
          ...issues,
          { code: 'INSUFFICIENT_TEST_CANDIDATES', path: '$.scheduleGames', message: `Max test candidates: ${maxTestCount}` },
        ]),
      };
    }
    return {
      ok: false,
      issues: sortPlanIssues([
        ...issues,
        { code: 'NO_FEASIBLE_BOUNDARY', path: '$.scheduleGames', message: 'No officialDate boundary satisfies both target counts' },
      ]),
    };
  }

  // 8. Derive validation/test sides
  const validationSideGames = eligibleGames.filter((g) => g.officialDate <= validationBoundaryOfficialDate);
  const testSideGames = eligibleGames.filter((g) => g.officialDate > validationBoundaryOfficialDate);
  const validationSideAvailableCount = validationSideGames.length;
  const testSideAvailableCount = testSideGames.length;

  // 9. Activation deadline = scientific cutoff of first validation-side game
  const firstValidationGame = validationSideGames[0];
  const activationDeadlineAt = firstValidationGame.scientificCutoffAt;

  // 10. Staleness check
  const deadlineMs = Date.parse(activationDeadlineAt);
  if (!Number.isFinite(deadlineMs) || planningReferenceMs >= deadlineMs) {
    return {
      ok: false,
      issues: sortPlanIssues([
        ...issues,
        { code: 'PLAN_ALREADY_STALE', path: '$.planningReferenceAt', message: 'planningReferenceAt is not strictly before activationDeadlineAt' },
      ]),
    };
  }

  // 11. Build activation payload preview
  const activationPayload: MLBProspectiveHoldoutActivation = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: input.activationId,
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    validationBoundaryOfficialDate,
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
    validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
    testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
    noSmallerN: true,
    resultIndependentSelection: true,
    testAuthorizationRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
    gameIdentityBindingContractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    gameIdentityBindingStoreVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  };

  const activationValidation = validateMLBProspectiveHoldoutActivation(activationPayload);
  if (!activationValidation.ok) {
    return {
      ok: false,
      issues: sortPlanIssues([
        ...issues,
        { code: 'ACTIVATION_CONTRACT_INVALID', path: '$.activationPayload', message: 'Activation payload preview failed validation' },
      ]),
    };
  }

  // 12. Schedule universe fingerprint
  const scheduleUniverseFingerprint = computeScheduleUniverseFingerprint(eligibleGames);

  // 13. Build plan body (excluding planFingerprint)
  const planBody: {
    planContractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION;
  } & Omit<
    MLBProspectiveHoldoutActivationPlan,
    'contractVersion' | 'planFingerprint'
  > & {
    stableOrderPolicy: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY;
    validationSideDateRule: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE;
    testSideDateRule: typeof MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE;
    noSmallerN: true;
    resultIndependentSelection: true;
    candidateRecipeId: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID;
    candidateFingerprint: typeof MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT;
  } = {
    planContractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION,
    boundarySelectionPolicyId: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_BOUNDARY_SELECTION_POLICY_ID,
    activationId: input.activationId,
    planningReferenceAt,
    validationBoundaryOfficialDate,
    activationDeadlineAt,
    inputGameCount,
    prospectivelyEligibleGameCount,
    validationSideAvailableCount,
    testSideAvailableCount,
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
    validationSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
    testSideDateRule: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
    noSmallerN: true,
    resultIndependentSelection: true,
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    scheduleUniverseFingerprint,
    activationPayload,
    firstValidationGamePk: validationSideGames[0]?.gamePk ?? null,
    firstTestSideGamePk: testSideGames[0]?.gamePk ?? null,
  };

  const planFingerprint = crypto.createHash('sha256')
    .update(canonicalJson(planBody))
    .digest('hex');

  const plan: MLBProspectiveHoldoutActivationPlan = Object.freeze({
    ...planBody,
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_PLAN_CONTRACT_VERSION,
    planFingerprint,
  });

  return { ok: true, plan };
}

function computeScheduleUniverseFingerprint(
  eligibleGames: Array<{
    gamePk: number;
    officialDate: string;
    scheduledStartAt: string;
    scientificCutoffAt: string;
  }>,
): string {
  const canonicalRecords = eligibleGames.map((game) => ({
    gamePk: game.gamePk,
    officialDate: game.officialDate,
    scheduledStartAt: game.scheduledStartAt,
    scientificCutoffAt: game.scientificCutoffAt,
  }));
  return crypto.createHash('sha256')
    .update(JSON.stringify(canonicalRecords))
    .digest('hex');
}
