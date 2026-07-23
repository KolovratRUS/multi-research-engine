import {
  buildMLBLocalDryRunManifest,
  buildMLBLocalDryRunScheduleSnapshot,
  buildMLBLocalDryRunPregameResearchSnapshots,
  buildMLBLocalDryRunLockedWeeklyOutput,
  buildMLBLocalDryRunOutcomeAttachments,
  buildMLBLocalDryRunEvaluationReport,
} from '@/prospective/mlb/local-dry-run-sample';
import {
  validateProspectiveScheduleSnapshot,
  validatePregameResearchSnapshot,
  validateLockedWeeklyOutput,
  validateOutcomeAttachment,
} from '@/prospective/mlb/weekly-test-schemas';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function runMLBLocalDryRunCheck(): void {
  const manifest = buildMLBLocalDryRunManifest();
  const scheduleSnapshot = buildMLBLocalDryRunScheduleSnapshot();
  const pregameResearchSnapshots = buildMLBLocalDryRunPregameResearchSnapshots();
  const lockedWeeklyOutput = buildMLBLocalDryRunLockedWeeklyOutput();
  const outcomeAttachments = buildMLBLocalDryRunOutcomeAttachments();
  const evaluationReport = buildMLBLocalDryRunEvaluationReport();

  const scheduleValidation = validateProspectiveScheduleSnapshot(scheduleSnapshot);
  const pregameValidation = pregameResearchSnapshots.flatMap((snapshot) =>
    validatePregameResearchSnapshot(snapshot),
  );
  const lockedValidation = validateLockedWeeklyOutput(lockedWeeklyOutput);
  const outcomeValidation = outcomeAttachments.flatMap((attachment) =>
    validateOutcomeAttachment(attachment),
  );

  const allMessages = [
    ...scheduleValidation,
    ...pregameValidation,
    ...lockedValidation,
    ...outcomeValidation,
  ];

  const errorCount = allMessages.filter((m) => m.severity === 'error').length;
  const warningCount = allMessages.filter((m) => m.severity === 'warning').length;

  const hasFinalScoreInPregame = pregameResearchSnapshots.some((snapshot) =>
    isObject(snapshot) && 'finalScore' in snapshot,
  );

  const hasCompletedGameStateInPregame = pregameResearchSnapshots.some((snapshot) =>
    isObject(snapshot) && 'completedGameState' in snapshot,
  );

  const summary: unknown = {
    runId: manifest.runId,
    sourceMode: manifest.sourceMode,
    weekStart: manifest.weekStart,
    weekEnd: manifest.weekEnd,
    gameCount: scheduleSnapshot.games.length,
    pregameResearchCount: pregameResearchSnapshots.length,
    lockedOutputCount: 1,
    outcomeAttachmentCount: outcomeAttachments.length,
    evaluationReportPresent: Boolean(evaluationReport),
    scheduleValidationMessageCount: scheduleValidation.length,
    pregameValidationMessageCount: pregameValidation.length,
    lockedValidationMessageCount: lockedValidation.length,
    outcomeValidationMessageCount: outcomeValidation.length,
    validationErrorCount: errorCount,
    validationWarningCount: warningCount,
    passed: errorCount === 0,
    modelProbabilityStatus: 'null',
    pregameSnapshotsContainFinalScore: hasFinalScoreInPregame,
    pregameSnapshotsContainCompletedGameState: hasCompletedGameStateInPregame,
    historicalFixtureInventoryTouched: false,
  };

  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  if (errorCount > 0) {
    process.exitCode = 1;
  }
}

runMLBLocalDryRunCheck();
