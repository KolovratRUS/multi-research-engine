import { describe, expect, it } from 'vitest';
import {
  buildMLBProspectiveHoldoutSmokePreflight,
  validateMLBProspectiveHoldoutFirstSmokeState,
  MLB_PROSPECTIVE_HOLDOUT_SMOKE_PREFLIGHT_CONTRACT_VERSION,
  type MLBProspectiveHoldoutSmokePreflightSuccess,
  type MLBProspectiveHoldoutSmokePreflightError,
  type MLBProspectiveHoldoutSmokeScheduleGame,
} from '@/prediction/mlb/mlb-prospective-holdout-smoke-preflight';
import {
  computeScientificCutoffAt,
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import type {
  MLBProspectiveHoldoutProgressReport,
  MLBProspectiveHoldoutProgressReportAnomalies,
} from '@/prediction/mlb/mlb-prospective-holdout-progress-report';

/* -------------------------------------------------------------------------- */
/*  Fixture builders                                                          */
/* -------------------------------------------------------------------------- */

function assertSuccess(
  result: MLBProspectiveHoldoutSmokePreflightSuccess | MLBProspectiveHoldoutSmokePreflightError,
): asserts result is MLBProspectiveHoldoutSmokePreflightSuccess {
  if (!('contractVersion' in result)) {
    throw new Error('Expected success result but got error: ' + JSON.stringify(result));
  }
}

function buildAnomalies(
  overrides: Partial<MLBProspectiveHoldoutProgressReportAnomalies> = {},
): MLBProspectiveHoldoutProgressReportAnomalies {
  return {
    orphanEvidenceCount: 0,
    foreignEvidenceCount: 0,
    foreignBindingCount: 0,
    temporaryDebrisCount: 0,
    unknownFilesCount: 0,
    ...overrides,
  };
}

function buildProgressReport(
  overrides: Partial<MLBProspectiveHoldoutProgressReport> = {},
): MLBProspectiveHoldoutProgressReport {
  const base: MLBProspectiveHoldoutProgressReport = {
    contractVersion: 'mlb-prospective-holdout-progress-report-v1',
    activationId: 'activation-900001',
    protocolId: 'mlb-v1-candidate-003-prospective-holdout-v1',
    candidateRecipeId: 'candidate-recipe-1',
    candidateFingerprint: 'fingerprint-1',
    validationBoundaryOfficialDate: '2026-09-15',
    validationTargetCount: 67,
    testTargetCount: 69,
    stableOrderPolicy: 'scheduledStartAt_ASC_gamePk_ASC',
    resultIndependentSelection: true,
    testAuthorizationRule: 'NO_TEST_AUTHORIZATION',
    validationCapturedCount: 0,
    validationCapturedGamePks: [],
    validationCaptureComplete: false,
    validationRemainingCount: 67,
    testCapturedCount: 0,
    testCapturedGamePks: [],
    testCaptureComplete: false,
    testRemainingCount: 69,
    totalCapturedCount: 0,
    totalTargetCount: 136,
    totalRemainingCount: 136,
    allCaptureComplete: false,
    anomalies: buildAnomalies(),
  };
  return { ...base, ...overrides };
}

function buildScheduleGame(
  overrides: Partial<MLBProspectiveHoldoutSmokeScheduleGame> = {},
): MLBProspectiveHoldoutSmokeScheduleGame {
  return {
    gamePk: 100000,
    gameType: 'R',
    officialDate: '2026-09-15',
    startTimeUtc: new Date('2026-09-15T18:00:00Z'),
    status: 'UPCOMING',
    ...overrides,
  };
}

/* -------------------------------------------------------------------------- */
/*  T360 helpers                                                             */
/* -------------------------------------------------------------------------- */

const BASE_START = '2026-09-03T18:00:00Z';
const BASE_CUTOFF_RESULT = computeScientificCutoffAt(BASE_START);
if (!BASE_CUTOFF_RESULT.ok) {
  throw new Error('Base T360 cutoff failed during test setup');
}
const BASE_CUTOFF = BASE_CUTOFF_RESULT.scientificCutoffAt;

function beforeCutoffDate(): Date {
  return new Date('2026-09-03T11:59:59Z');
}

function exactCutoffDate(): Date {
  return new Date(BASE_CUTOFF);
}

function afterCutoffDate(): Date {
  return new Date('2026-09-03T12:00:01Z');
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-smoke-preflight-pure', () => {
  // 1. exact contract version
  it('1. exact contract version', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result.contractVersion).toBe(
      MLB_PROSPECTIVE_HOLDOUT_SMOKE_PREFLIGHT_CONTRACT_VERSION,
    );
  });

  // 2. exact 21 top-level success keys
  it('2. exact 21 top-level success keys', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    const keys = Object.keys(result);
    expect(keys).toHaveLength(21);
    expect(keys).toEqual([
      'contractVersion',
      'activationId',
      'protocolId',
      'candidateRecipeId',
      'candidateFingerprint',
      'validationBoundaryOfficialDate',
      'validationTargetCount',
      'testTargetCount',
      'currentValidationCapturedCount',
      'currentTestCapturedCount',
      'currentTotalCapturedCount',
      'currentAnomalies',
      'selectedGamePk',
      'selectedOfficialDate',
      'selectedScheduledStartAt',
      'selectedScientificCutoffAt',
      'selectedSide',
      'stableOrderPolicy',
      'resultIndependentSelection',
      'captureAuthorized',
      'captureCommandPreview',
    ]);
  });

  // 3. captureAuthorized literal false
  it('3. captureAuthorized is literal false', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result.captureAuthorized).toBe(false);
  });

  // 4. exact K2 captureCommandPreview
  it('4. exact captureCommandPreview template', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ gamePk: 123456, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result.captureCommandPreview).toBe(
      'npx tsx scripts/mlb-prospective-holdout-capture.ts --gamePk=123456',
    );
  });

  // 5. selectedSide exact VALIDATION
  it('5. selectedSide is VALIDATION', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result.selectedSide).toBe('VALIDATION');
  });

  // 6. zero progress success state
  it('6. zero progress success state', () => {
    const report = buildProgressReport({
      validationCapturedCount: 0,
      testCapturedCount: 0,
      totalCapturedCount: 0,
    });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
  });

  // 7. validation progress nonzero rejects
  it('7. validation progress nonzero rejects', () => {
    const report = buildProgressReport({ validationCapturedCount: 1 });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'FIRST_SMOKE_PROGRESS_NOT_ZERO' });
  });

  // 8. test progress nonzero rejects
  it('8. test progress nonzero rejects', () => {
    const report = buildProgressReport({ testCapturedCount: 1 });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'FIRST_SMOKE_PROGRESS_NOT_ZERO' });
  });

  // 9. total progress nonzero rejects
  it('9. total progress nonzero rejects', () => {
    const report = buildProgressReport({ totalCapturedCount: 1 });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'FIRST_SMOKE_PROGRESS_NOT_ZERO' });
  });

  // 10. orphanEvidenceCount rejects
  it('10. orphanEvidenceCount nonzero rejects', () => {
    const report = buildProgressReport({ anomalies: buildAnomalies({ orphanEvidenceCount: 1 }) });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'FIRST_SMOKE_STATE_NOT_PRISTINE' });
  });

  // 11. foreignEvidenceCount rejects
  it('11. foreignEvidenceCount nonzero rejects', () => {
    const report = buildProgressReport({ anomalies: buildAnomalies({ foreignEvidenceCount: 1 }) });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'FIRST_SMOKE_STATE_NOT_PRISTINE' });
  });

  // 12. foreignBindingCount rejects
  it('12. foreignBindingCount nonzero rejects', () => {
    const report = buildProgressReport({ anomalies: buildAnomalies({ foreignBindingCount: 1 }) });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'FIRST_SMOKE_STATE_NOT_PRISTINE' });
  });

  // 13. temporaryDebrisCount rejects
  it('13. temporaryDebrisCount nonzero rejects', () => {
    const report = buildProgressReport({ anomalies: buildAnomalies({ temporaryDebrisCount: 1 }) });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'FIRST_SMOKE_STATE_NOT_PRISTINE' });
  });

  // 14. unknownFilesCount rejects
  it('14. unknownFilesCount nonzero rejects', () => {
    const report = buildProgressReport({ anomalies: buildAnomalies({ unknownFilesCount: 1 }) });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'FIRST_SMOKE_STATE_NOT_PRISTINE' });
  });

  // 15. unexpected testAuthorizationRule fails closed
  it('15. unexpected testAuthorizationRule fails closed', () => {
    const report = buildProgressReport({ testAuthorizationRule: 'UNKNOWN' });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'ACTIVATION_STATE_INVALID' });
  });

  // 16. R + UPCOMING validation candidate accepted
  it('16. R + UPCOMING validation candidate accepted', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result.selectedGamePk).toBe(100000);
  });

  // 17. non-R candidate excluded
  it('17. non-R candidate excluded', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ gameType: 'S', officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
  });

  // 18. LIVE candidate excluded
  it('18. LIVE candidate excluded', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ status: 'LIVE', officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
  });

  // 19. FINAL candidate excluded
  it('19. FINAL candidate excluded', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ status: 'FINAL', officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
  });

  // 20. POSTPONED candidate excluded
  it('20. POSTPONED candidate excluded', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ status: 'POSTPONED', officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
  });

  // 21. CANCELLED candidate excluded
  it('21. CANCELLED candidate excluded', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ status: 'CANCELLED', officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
  });

  // 22. strict before T360 eligible
  it('22. strict before T360 eligible', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
  });

  // 23. exact T360 excluded
  it('23. exact T360 excluded', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: exactCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
  });

  // 24. after T360 excluded
  it('24. after T360 excluded', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: afterCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
  });

  // 25. game officialDate > validation boundary not selectable
  it('25. game officialDate > validation boundary not selectable', () => {
    const report = buildProgressReport({ validationBoundaryOfficialDate: '2026-09-10' });
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-11', startTimeUtc: new Date('2026-09-11T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(false);
    expect(result).toMatchObject({ kind: 'NO_ELIGIBLE_SMOKE_GAME' });
  });

  // 26. scheduledStartAt ordering
  it('26. scheduledStartAt ordering selects earliest start', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ gamePk: 200000, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T20:00:00Z') }),
        buildScheduleGame({ gamePk: 100000, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result.selectedGamePk).toBe(100000);
  });

  // 27. numeric gamePk tie-break
  it('27. numeric gamePk tie-break', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ gamePk: 200000, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
        buildScheduleGame({ gamePk: 100000, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result.selectedGamePk).toBe(100000);
  });

  // 28. doubleheader/different gamePk remain separate but only one returned
  it('28. doubleheader different gamePk remain separate', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ gamePk: 100000, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
        buildScheduleGame({ gamePk: 100001, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result.selectedGamePk).toBe(100000);
  });

  // 29. only one game returned
  it('29. only one game returned in success', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ gamePk: 100000, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
        buildScheduleGame({ gamePk: 100001, officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result).not.toHaveProperty('selectedGamePks');
    expect(result).toHaveProperty('selectedGamePk');
  });

  // 30. no future cohort/gamePk array field
  it('30. no future cohort or gamePk array field', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    const keys = Object.keys(result);
    expect(keys).not.toContain('gamePks');
    expect(keys).not.toContain('futureCohort');
  });

  // 31. no result/odds/model scientific inputs
  it('31. no result odds or model scientific inputs in success', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2026-09-03', startTimeUtc: new Date('2026-09-03T18:00:00Z') }),
      ],
      trustedNow: beforeCutoffDate(),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result).not.toHaveProperty('homeTeam');
    expect(result).not.toHaveProperty('awayTeam');
    expect(result).not.toHaveProperty('pitchers');
    expect(result).not.toHaveProperty('odds');
    expect(result).not.toHaveProperty('modelPrediction');
  });

  // Additional: validate state validator directly
  it('rejects unknown test authorization rule', () => {
    const error = validateMLBProspectiveHoldoutFirstSmokeState(
      buildProgressReport({ testAuthorizationRule: 'UNKNOWN' }),
    );
    expect(error).not.toBeNull();
    expect(error?.kind).toBe('ACTIVATION_STATE_INVALID');
  });

  it('rejects nonzero anomalies', () => {
    const error = validateMLBProspectiveHoldoutFirstSmokeState(
      buildProgressReport({ anomalies: buildAnomalies({ orphanEvidenceCount: 1 }) }),
    );
    expect(error).not.toBeNull();
    expect(error?.kind).toBe('FIRST_SMOKE_STATE_NOT_PRISTINE');
  });

  it('35. canonical officialDate accepts valid leap day', () => {
    const report = buildProgressReport();
    const result = buildMLBProspectiveHoldoutSmokePreflight({
      progressReport: report,
      scheduleGames: [
        buildScheduleGame({ officialDate: '2024-02-29', startTimeUtc: new Date('2024-02-29T18:00:00Z') }),
      ],
      trustedNow: new Date('2024-02-28T12:00:00Z'),
    });
    expect('contractVersion' in result).toBe(true);
    assertSuccess(result);
    expect(result.selectedOfficialDate).toBe('2024-02-29');
  });
});
