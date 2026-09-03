import type {
  MLBProspectiveHoldoutActivationPersisted,
} from './mlb-prospective-holdout-activation-contract';
import type {
  MLBProspectiveHoldoutArtifactDiscoverySuccess,
  MLBProspectiveHoldoutArtifactDiscoveryCandidate,
  MLBProspectiveHoldoutArtifactRescheduleConflict,
} from './mlb-prospective-holdout-artifact-discovery';

/* -------------------------------------------------------------------------- */
/*  Host-local error domain                                                   */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutProgressReportError = Readonly<
  | {
      readonly kind: 'PROGRESS_INTEGRITY_CONFLICT';
      readonly issues: readonly MLBProspectiveHoldoutProgressReportIssue[];
    }
    | {
      readonly kind: 'CAPTURE_COUNT_EXCEEDS_TARGET';
      readonly issues: readonly MLBProspectiveHoldoutProgressReportIssue[];
    }
>;

export type MLBProspectiveHoldoutProgressReportIssue = Readonly<{
  readonly code: string;
  readonly path: string;
  readonly message: string;
}>;

/* -------------------------------------------------------------------------- */
/*  Report contract                                                           */
/* -------------------------------------------------------------------------- */

export const MLB_PROSPECTIVE_HOLDOUT_PROGRESS_REPORT_CONTRACT_VERSION =
  'mlb-prospective-holdout-progress-report-v1' as const;

export type MLBProspectiveHoldoutProgressReportAnomalies = Readonly<{
  readonly orphanEvidenceCount: number;
  readonly foreignEvidenceCount: number;
  readonly foreignBindingCount: number;
  readonly temporaryDebrisCount: number;
  readonly unknownFilesCount: number;
}>;

export type MLBProspectiveHoldoutProgressReport = Readonly<{
  readonly contractVersion: typeof MLB_PROSPECTIVE_HOLDOUT_PROGRESS_REPORT_CONTRACT_VERSION;
  readonly activationId: string;
  readonly protocolId: string;
  readonly candidateRecipeId: string;
  readonly candidateFingerprint: string;
  readonly validationBoundaryOfficialDate: string;
  readonly validationTargetCount: number;
  readonly testTargetCount: number;
  readonly stableOrderPolicy: string;
  readonly resultIndependentSelection: boolean;
  readonly testAuthorizationRule: string;
  readonly validationCapturedCount: number;
  readonly validationCapturedGamePks: readonly number[];
  readonly validationCaptureComplete: boolean;
  readonly validationRemainingCount: number;
  readonly testCapturedCount: number;
  readonly testCapturedGamePks: readonly number[];
  readonly testCaptureComplete: boolean;
  readonly testRemainingCount: number;
  readonly totalCapturedCount: number;
  readonly totalTargetCount: number;
  readonly totalRemainingCount: number;
  readonly allCaptureComplete: boolean;
  readonly anomalies: MLBProspectiveHoldoutProgressReportAnomalies;
}>;

/* -------------------------------------------------------------------------- */
/*  Pure builder                                                              */
/* -------------------------------------------------------------------------- */

export type MLBProspectiveHoldoutProgressReportBuildInput = Readonly<{
  readonly activation: MLBProspectiveHoldoutActivationPersisted;
  readonly discovery: MLBProspectiveHoldoutArtifactDiscoverySuccess;
}>;

function pushReportIssue(
  issues: MLBProspectiveHoldoutProgressReportIssue[],
  code: string,
  path: string,
  message: string,
): void {
  const exists = issues.some((item) => item.path === path && item.code === code);
  if (!exists) {
    issues.push({ code, path, message });
  }
}

function sortReportIssues(
  issues: readonly MLBProspectiveHoldoutProgressReportIssue[],
): readonly MLBProspectiveHoldoutProgressReportIssue[] {
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

function compareCandidates(
  a: MLBProspectiveHoldoutArtifactDiscoveryCandidate,
  b: MLBProspectiveHoldoutArtifactDiscoveryCandidate,
): number {
  const startDiff =
    a.evidence.scheduledStartAt < b.evidence.scheduledStartAt
      ? -1
      : a.evidence.scheduledStartAt === b.evidence.scheduledStartAt
        ? 0
        : 1;
  if (startDiff !== 0) return startDiff;
  return a.binding.gamePk - b.binding.gamePk;
}

export function buildMLBProspectiveHoldoutProgressReport(
  input: MLBProspectiveHoldoutProgressReportBuildInput,
):
  | MLBProspectiveHoldoutProgressReport
  | MLBProspectiveHoldoutProgressReportError {
  const { activation, discovery } = input;

  const candidates = discovery.candidates;
  const rescheduleConflicts = discovery.rescheduleConflicts;

  if (rescheduleConflicts.length > 0) {
    const issues = sortReportIssues(
      rescheduleConflicts.map((conflict, index) => ({
        code: 'RESCHEDULE_CONFLICT',
        path: `$.rescheduleConflicts[${index}]`,
        message: `Reschedule conflict detected for gamePk ${conflict.gamePk}`,
      })),
    );
    return {
      kind: 'PROGRESS_INTEGRITY_CONFLICT',
      issues,
    };
  }

  const sorted = candidates.slice().sort(compareCandidates);

  const validationGamePks: number[] = [];
  const testGamePks: number[] = [];

  for (const candidate of sorted) {
    if (candidate.evidence.officialDate <= activation.validationBoundaryOfficialDate) {
      validationGamePks.push(candidate.binding.gamePk);
    } else {
      testGamePks.push(candidate.binding.gamePk);
    }
  }

  const validationCapturedCount = validationGamePks.length;
  const testCapturedCount = testGamePks.length;
  const totalCapturedCount = validationCapturedCount + testCapturedCount;
  const totalTargetCount = activation.validationTargetCount + activation.testTargetCount;

  if (validationCapturedCount > activation.validationTargetCount) {
    const issues = sortReportIssues([
      {
        code: 'CAPTURE_COUNT_EXCEEDS_TARGET',
        path: '$.validationCapturedCount',
        message: `Validation captured count ${validationCapturedCount} exceeds target ${activation.validationTargetCount}`,
      },
    ]);
    return { kind: 'CAPTURE_COUNT_EXCEEDS_TARGET', issues };
  }

  if (testCapturedCount > activation.testTargetCount) {
    const issues = sortReportIssues([
      {
        code: 'CAPTURE_COUNT_EXCEEDS_TARGET',
        path: '$.testCapturedCount',
        message: `Test captured count ${testCapturedCount} exceeds target ${activation.testTargetCount}`,
      },
    ]);
    return { kind: 'CAPTURE_COUNT_EXCEEDS_TARGET', issues };
  }

  const validationRemainingCount = activation.validationTargetCount - validationCapturedCount;
  const testRemainingCount = activation.testTargetCount - testCapturedCount;
  const totalRemainingCount = totalTargetCount - totalCapturedCount;

  const orphanEvidence = discovery.orphanEvidence;
  const foreignArtifactSummary = discovery.foreignArtifactSummary;
  const temporaryDebris = discovery.temporaryDebris;
  const unknownFiles = discovery.unknownFiles;

  return {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_PROGRESS_REPORT_CONTRACT_VERSION,
    activationId: activation.activationId,
    protocolId: activation.protocolId,
    candidateRecipeId: activation.candidateRecipeId,
    candidateFingerprint: activation.candidateFingerprint,
    validationBoundaryOfficialDate: activation.validationBoundaryOfficialDate,
    validationTargetCount: activation.validationTargetCount,
    testTargetCount: activation.testTargetCount,
    stableOrderPolicy: activation.stableOrderPolicy,
    resultIndependentSelection: activation.resultIndependentSelection,
    testAuthorizationRule: activation.testAuthorizationRule,
    validationCapturedCount,
    validationCapturedGamePks: Object.freeze(validationGamePks),
    validationCaptureComplete: validationCapturedCount === activation.validationTargetCount,
    validationRemainingCount,
    testCapturedCount,
    testCapturedGamePks: Object.freeze(testGamePks),
    testCaptureComplete: testCapturedCount === activation.testTargetCount,
    testRemainingCount,
    totalCapturedCount,
    totalTargetCount,
    totalRemainingCount,
    allCaptureComplete:
      validationCapturedCount === activation.validationTargetCount &&
      testCapturedCount === activation.testTargetCount,
    anomalies: Object.freeze({
      orphanEvidenceCount: orphanEvidence.length,
      foreignEvidenceCount: foreignArtifactSummary.foreignEvidenceCount,
      foreignBindingCount: foreignArtifactSummary.foreignBindingCount,
      temporaryDebrisCount: temporaryDebris.length,
      unknownFilesCount: unknownFiles.length,
    }),
  } as const;
}
