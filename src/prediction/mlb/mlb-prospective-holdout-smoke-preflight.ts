import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from './mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
  computeScientificCutoffAt,
} from './mlb-prospective-t360-capture-contract';
import type {
  MLBProspectiveHoldoutProgressReport,
  MLBProspectiveHoldoutProgressReportAnomalies,
} from './mlb-prospective-holdout-progress-report';

/* -------------------------------------------------------------------------- */
/*  Contract version                                                          */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_HOLDOUT_SMOKE_PREFLIGHT_CONTRACT_VERSION =
  'mlb-prospective-holdout-smoke-preflight-v1' as const;

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutSmokeScheduleGame = Readonly<{
  readonly gamePk: number;
  readonly gameType: string;
  readonly officialDate: string;
  readonly startTimeUtc: Date;
  readonly status: 'UPCOMING' | 'LIVE' | 'FINAL' | 'POSTPONED' | 'CANCELLED';
}>;

export type MLBProspectiveHoldoutSmokePreflightInput = Readonly<{
  readonly progressReport: MLBProspectiveHoldoutProgressReport;
  readonly scheduleGames: readonly MLBProspectiveHoldoutSmokeScheduleGame[];
  readonly trustedNow: Date;
}>;

export type MLBProspectiveHoldoutSmokePreflightIssue = Readonly<{
  readonly code: string;
  readonly path: string;
  readonly message: string;
}>;

export type MLBProspectiveHoldoutSmokePreflightError =
  | { readonly kind: 'ACTIVATION_STATE_INVALID'; readonly issues: readonly MLBProspectiveHoldoutSmokePreflightIssue[] }
  | { readonly kind: 'FIRST_SMOKE_PROGRESS_NOT_ZERO'; readonly issues: readonly MLBProspectiveHoldoutSmokePreflightIssue[] }
  | { readonly kind: 'FIRST_SMOKE_STATE_NOT_PRISTINE'; readonly issues: readonly MLBProspectiveHoldoutSmokePreflightIssue[] }
  | { readonly kind: 'SCHEDULE_STATE_INVALID'; readonly issues: readonly MLBProspectiveHoldoutSmokePreflightIssue[] }
  | { readonly kind: 'NO_ELIGIBLE_SMOKE_GAME'; readonly issues: readonly MLBProspectiveHoldoutSmokePreflightIssue[] };

export type MLBProspectiveHoldoutSmokePreflightSuccess = Readonly<{
  readonly contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_SMOKE_PREFLIGHT_CONTRACT_VERSION;
  readonly activationId: string;
  readonly protocolId: string;
  readonly candidateRecipeId: string;
  readonly candidateFingerprint: string;
  readonly validationBoundaryOfficialDate: string;
  readonly validationTargetCount: number;
  readonly testTargetCount: number;
  readonly currentValidationCapturedCount: number;
  readonly currentTestCapturedCount: number;
  readonly currentTotalCapturedCount: number;
  readonly currentAnomalies: MLBProspectiveHoldoutProgressReportAnomalies;
  readonly selectedGamePk: number;
  readonly selectedOfficialDate: string;
  readonly selectedScheduledStartAt: string;
  readonly selectedScientificCutoffAt: string;
  readonly selectedSide: 'VALIDATION';
  readonly stableOrderPolicy: string;
  readonly resultIndependentSelection: boolean;
  readonly captureAuthorized: false;
  readonly captureCommandPreview: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Pure state validator                                                     */
/* -------------------------------------------------------------------------- */

export function validateMLBProspectiveHoldoutFirstSmokeState(
  report: MLBProspectiveHoldoutProgressReport,
): MLBProspectiveHoldoutSmokePreflightError | null {
  if (report.testAuthorizationRule !== 'NO_TEST_AUTHORIZATION') {
    return {
      kind: 'ACTIVATION_STATE_INVALID',
      issues: [
        {
          code: 'UNEXPECTED_TEST_AUTHORIZATION_RULE',
          path: '$.testAuthorizationRule',
          message: `Expected NO_TEST_AUTHORIZATION, got ${report.testAuthorizationRule}`,
        },
      ],
    };
  }

  if (
    report.validationCapturedCount !== 0 ||
    report.testCapturedCount !== 0 ||
    report.totalCapturedCount !== 0
  ) {
    return {
      kind: 'FIRST_SMOKE_PROGRESS_NOT_ZERO',
      issues: [
        {
          code: 'NONZERO_PROGRESS',
          path: '$.totalCapturedCount',
          message: `First smoke requires zero progress: validation=${report.validationCapturedCount}, test=${report.testCapturedCount}, total=${report.totalCapturedCount}`,
        },
      ],
    };
  }

  if (
    report.anomalies.orphanEvidenceCount !== 0 ||
    report.anomalies.foreignEvidenceCount !== 0 ||
    report.anomalies.foreignBindingCount !== 0 ||
    report.anomalies.temporaryDebrisCount !== 0 ||
    report.anomalies.unknownFilesCount !== 0
  ) {
    return {
      kind: 'FIRST_SMOKE_STATE_NOT_PRISTINE',
      issues: [
        {
          code: 'NONZERO_ANOMALY',
          path: '$.anomalies',
          message: `First smoke requires zero anomalies: orphanEvidence=${report.anomalies.orphanEvidenceCount}, foreignEvidence=${report.anomalies.foreignEvidenceCount}, foreignBinding=${report.anomalies.foreignBindingCount}, temporaryDebris=${report.anomalies.temporaryDebrisCount}, unknownFiles=${report.anomalies.unknownFilesCount}`,
        },
      ],
    };
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/*  Pure builder                                                              */
/* -------------------------------------------------------------------------- */

export function buildMLBProspectiveHoldoutSmokePreflight(
  input: MLBProspectiveHoldoutSmokePreflightInput,
):
  | MLBProspectiveHoldoutSmokePreflightSuccess
  | MLBProspectiveHoldoutSmokePreflightError {
  const { progressReport, scheduleGames, trustedNow } = input;

  const stateError = validateMLBProspectiveHoldoutFirstSmokeState(progressReport);
  if (stateError) return stateError;

  const boundary = progressReport.validationBoundaryOfficialDate;

  const candidates = scheduleGames.filter((game): boolean => {
    if (game.officialDate > boundary) return false;
    if (game.gameType !== 'R') return false;
    if (game.status !== 'UPCOMING') return false;
    return true;
  });

  const trustedNowMs = Date.parse(trustedNow.toISOString());
  if (!Number.isFinite(trustedNowMs)) {
    return {
      kind: 'SCHEDULE_STATE_INVALID',
      issues: [
        {
          code: 'INVALID_TRUSTED_NOW',
          path: '$.trustedNow',
          message: 'trustedNow is not a valid Date',
        },
      ],
    };
  }

  const withCutoffs: Array<{
    readonly game: MLBProspectiveHoldoutSmokeScheduleGame;
    readonly cutoffMs: number;
  }> = [];

  for (const game of candidates) {
    const cutoffResult = computeScientificCutoffAt(game.startTimeUtc.toISOString());
    if (!cutoffResult.ok) {
      return {
        kind: 'SCHEDULE_STATE_INVALID',
        issues: [
          {
            code: 'INVALID_SCIENTIFIC_CUTOFF',
            path: `$.games[${game.gamePk}].startTimeUtc`,
            message: cutoffResult.message,
          },
        ],
      };
    }

    const cutoffMs = Date.parse(cutoffResult.scientificCutoffAt);
    if (!Number.isFinite(cutoffMs)) {
      return {
        kind: 'SCHEDULE_STATE_INVALID',
        issues: [
          {
            code: 'INVALID_CUTOFF_TIMESTAMP',
            path: `$.games[${game.gamePk}].startTimeUtc`,
            message: 'Computed scientific cutoff is not a finite timestamp',
          },
        ],
      };
    }

    withCutoffs.push({ game, cutoffMs });
  }

  const eligible = withCutoffs
    .filter(({ cutoffMs }) => trustedNowMs < cutoffMs)
    .sort((a, b) => {
      const startDiff = a.game.startTimeUtc.getTime() - b.game.startTimeUtc.getTime();
      if (startDiff !== 0) return startDiff;
      return a.game.gamePk - b.game.gamePk;
    });

  if (eligible.length === 0) {
    return {
      kind: 'NO_ELIGIBLE_SMOKE_GAME',
      issues: [
        {
          code: 'NO_ELIGIBLE_SMOKE_GAME',
          path: '$',
          message: 'No eligible first-smoke game found within validation boundary',
        },
      ],
    };
  }

  const selected = eligible[0];
  const selectedGame = selected.game;

  return {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_SMOKE_PREFLIGHT_CONTRACT_VERSION,
    activationId: progressReport.activationId,
    protocolId: progressReport.protocolId,
    candidateRecipeId: progressReport.candidateRecipeId,
    candidateFingerprint: progressReport.candidateFingerprint,
    validationBoundaryOfficialDate: progressReport.validationBoundaryOfficialDate,
    validationTargetCount: progressReport.validationTargetCount,
    testTargetCount: progressReport.testTargetCount,
    currentValidationCapturedCount: progressReport.validationCapturedCount,
    currentTestCapturedCount: progressReport.testCapturedCount,
    currentTotalCapturedCount: progressReport.totalCapturedCount,
    currentAnomalies: progressReport.anomalies,
    selectedGamePk: selectedGame.gamePk,
    selectedOfficialDate: selectedGame.officialDate,
    selectedScheduledStartAt: selectedGame.startTimeUtc.toISOString(),
    selectedScientificCutoffAt: new Date(selected.cutoffMs).toISOString(),
    selectedSide: 'VALIDATION',
    stableOrderPolicy: progressReport.stableOrderPolicy,
    resultIndependentSelection: progressReport.resultIndependentSelection,
    captureAuthorized: false,
    captureCommandPreview: `npx tsx scripts/mlb-prospective-holdout-capture.ts --gamePk=${selectedGame.gamePk}`,
  };
}
