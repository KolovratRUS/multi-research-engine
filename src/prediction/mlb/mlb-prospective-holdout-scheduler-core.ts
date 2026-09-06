import type { MLBProspectiveHoldoutActivation } from './mlb-prospective-holdout-activation-contract';
import type { MLBScheduleGame } from '@/lib/research-data/types';

/* -------------------------------------------------------------------------- */
/*  Frozen contract identifiers                                               */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_HOLDOUT_SCHEDULER_CONTRACT_VERSION =
  'mlb-prospective-holdout-scheduler-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_SCHEDULER_POLICY_ID =
  'mlb-prospective-holdout-validation-scheduler-policy-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_SCHEDULER_TIMING_POLICY_ID =
  'mlb-prospective-holdout-t375-dispatch-policy-v1' as const;

export const MLB_PROSPECTIVE_HOLDOUT_SCHEDULER_EVENT_CONTRACT_VERSION =
  'mlb-prospective-holdout-scheduler-events-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Timing policy constants                                                   */
/* -------------------------------------------------------------------------- */

const SCIENTIFIC_CUTOFF_OFFSET_MINUTES = 360;
const TARGET_DISPATCH_OFFSET_MINUTES = 375;
const SCHEDULER_SAFETY_MARGIN_MINUTES = 15;

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutSchedulerCoreInput = Readonly<{
  readonly activation: Pick<
    MLBProspectiveHoldoutActivation,
    'validationBoundaryOfficialDate' | 'validationTargetCount'
  >;
  readonly validationCapturedCount: number;
  readonly testCapturedCount: number;
  readonly completedGamePks: readonly number[];
  readonly scheduleCandidates: readonly MLBScheduleGame[];
  readonly trustedNow: Date;
}>;

export type MLBProspectiveHoldoutSchedulerGameClassification =
  | Readonly<{ readonly kind: 'ELIGIBLE_DISPATCH' }>
  | Readonly<{ readonly kind: 'ELIGIBLE_WAIT'; readonly waitUntil: string }>
  | Readonly<{ readonly kind: 'SKIP_ALREADY_COMPLETE' }>
  | Readonly<{ readonly kind: 'MISSED_CUTOFF' }>
  | Readonly<{ readonly kind: 'TEST_SIDE_BLOCKED' }>
  | Readonly<{ readonly kind: 'INELIGIBLE_SCHEDULE_STATE'; readonly reason: string }>;

export type MLBProspectiveHoldoutSchedulerDecision =
  | Readonly<{ readonly kind: 'VALIDATION_TARGET_COMPLETE' }>
  | Readonly<{
      readonly kind: 'DISPATCH_NOW';
      readonly game: MLBScheduleGame;
      readonly classification: MLBProspectiveHoldoutSchedulerGameClassification & {
        readonly kind: 'ELIGIBLE_DISPATCH';
      };
    }>
  | Readonly<{ readonly kind: 'WAIT_UNTIL_TARGET'; readonly waitUntil: string }>
  | Readonly<{ readonly kind: 'VALIDATION_TARGET_UNREACHABLE' }>
  | Readonly<{ readonly kind: 'HUMAN_REVIEW_REQUIRED'; readonly reason: string }>;

/* -------------------------------------------------------------------------- */
/*  Pure core                                                                 */
/* -------------------------------------------------------------------------- */

export function planProspectiveHoldoutValidationDispatch(
  input: MLBProspectiveHoldoutSchedulerCoreInput,
): MLBProspectiveHoldoutSchedulerDecision {
  const {
    activation,
    validationCapturedCount,
    testCapturedCount,
    completedGamePks,
    scheduleCandidates,
    trustedNow,
  } = input;

  // 1. Progress invariants
  if (
    !Number.isFinite(validationCapturedCount) ||
    validationCapturedCount < 0 ||
    !Number.isInteger(validationCapturedCount)
  ) {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: 'validationCapturedCount is not a finite non-negative integer',
    };
  }
  if (
    !Number.isFinite(testCapturedCount) ||
    testCapturedCount < 0 ||
    !Number.isInteger(testCapturedCount)
  ) {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: 'testCapturedCount is not a finite non-negative integer',
    };
  }
  if (validationCapturedCount > 67) {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: 'validationCapturedCount exceeds 67',
    };
  }
  if (testCapturedCount > 0) {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: 'testCapturedCount is greater than 0',
    };
  }
  if (validationCapturedCount === 67) {
    return { kind: 'VALIDATION_TARGET_COMPLETE' };
  }

  // 2. Validate trustedNow
  const trustedNowMs = trustedNow.getTime();
  if (!Number.isFinite(trustedNowMs)) {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: 'trustedNow is not a finite date',
    };
  }

  // 3. Validate activation fields (defensive, since input is pre-validated)
  if (
    typeof activation.validationBoundaryOfficialDate !== 'string' ||
    activation.validationBoundaryOfficialDate.length === 0
  ) {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: 'validationBoundaryOfficialDate is not a non-empty string',
    };
  }
  if (activation.validationTargetCount !== 67) {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: 'validationTargetCount is not 67',
    };
  }

  // 4. Normalize and classify schedule candidates
  if (!Array.isArray(scheduleCandidates)) {
    return {
      kind: 'HUMAN_REVIEW_REQUIRED',
      reason: 'scheduleCandidates is not an array',
    };
  }

  const seenGamePks = new Set<number>();
  const processed: Array<{
    game: MLBScheduleGame;
    classification: MLBProspectiveHoldoutSchedulerGameClassification;
  }> = [];

  for (const game of scheduleCandidates) {
    // Validate gamePk
    if (
      !Number.isFinite(game.gamePk) ||
      !Number.isInteger(game.gamePk) ||
      game.gamePk <= 0
    ) {
      return {
        kind: 'HUMAN_REVIEW_REQUIRED',
        reason: `invalid gamePk: ${game.gamePk}`,
      };
    }

    // Duplicate gamePk check
    if (seenGamePks.has(game.gamePk)) {
      return {
        kind: 'HUMAN_REVIEW_REQUIRED',
        reason: `duplicate gamePk: ${game.gamePk}`,
      };
    }
    seenGamePks.add(game.gamePk);

    // Already complete
    if (completedGamePks.includes(game.gamePk)) {
      processed.push({
        game,
        classification: { kind: 'SKIP_ALREADY_COMPLETE' },
      });
      continue;
    }

    // Test side firewall
    if (game.officialDate > activation.validationBoundaryOfficialDate) {
      processed.push({
        game,
        classification: { kind: 'TEST_SIDE_BLOCKED' },
      });
      continue;
    }

    // Malformed officialDate
    if (game.officialDate.length === 0) {
      return {
        kind: 'HUMAN_REVIEW_REQUIRED',
        reason: `empty officialDate for gamePk ${game.gamePk}`,
      };
    }

    // Regular season requirement
    if (game.gameType !== 'REGULAR_SEASON') {
      processed.push({
        game,
        classification: {
          kind: 'INELIGIBLE_SCHEDULE_STATE',
          reason: `gameType is ${game.gameType}`,
        },
      });
      continue;
    }

    // Prospective/upcoming requirement
    if (game.status !== 'UPCOMING') {
      processed.push({
        game,
        classification: {
          kind: 'INELIGIBLE_SCHEDULE_STATE',
          reason: `status is ${game.status}`,
        },
      });
      continue;
    }

    // Validate scheduled start time
    const scheduledStartMs = game.startTimeUtc.getTime();
    if (!Number.isFinite(scheduledStartMs)) {
      return {
        kind: 'HUMAN_REVIEW_REQUIRED',
        reason: `invalid startTimeUtc for gamePk ${game.gamePk}`,
      };
    }

    // Compute timing
    const targetDispatchMs =
      scheduledStartMs - TARGET_DISPATCH_OFFSET_MINUTES * 60 * 1000;
    const scientificCutoffMs =
      scheduledStartMs - SCIENTIFIC_CUTOFF_OFFSET_MINUTES * 60 * 1000;

    if (trustedNowMs >= scientificCutoffMs) {
      processed.push({
        game,
        classification: { kind: 'MISSED_CUTOFF' },
      });
      continue;
    }

    if (trustedNowMs >= targetDispatchMs) {
      processed.push({
        game,
        classification: { kind: 'ELIGIBLE_DISPATCH' },
      });
    } else {
      processed.push({
        game,
        classification: {
          kind: 'ELIGIBLE_WAIT',
          waitUntil: new Date(targetDispatchMs).toISOString(),
        },
      });
    }
  }

  // 5. Stable order: scheduledStartAt ASC, then gamePk ASC
  processed.sort((a, b) => {
    const startDiff =
      a.game.startTimeUtc.getTime() - b.game.startTimeUtc.getTime();
    if (startDiff !== 0) return startDiff;
    return a.game.gamePk - b.game.gamePk;
  });

  // 6. Find best dispatch candidate
  for (const entry of processed) {
    if (entry.classification.kind === 'ELIGIBLE_DISPATCH') {
      return {
        kind: 'DISPATCH_NOW',
        game: entry.game,
        classification: entry.classification,
      };
    }
  }

  // 7. Find earliest wait candidate
  for (const entry of processed) {
    if (entry.classification.kind === 'ELIGIBLE_WAIT') {
      return {
        kind: 'WAIT_UNTIL_TARGET',
        waitUntil: entry.classification.waitUntil,
      };
    }
  }

  // 8. No remaining candidates
  return { kind: 'VALIDATION_TARGET_UNREACHABLE' };
}
