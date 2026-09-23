import { describe, expect, it } from 'vitest';
import {
  MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION,
  MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
  MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
  validateMLBShadowMonitoringOperationalRecord,
} from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';
import {
  validateMLBShadowQuarantinedPredictionPayload,
  validateMLBShadowQuarantinedOutcomePayload,
  validateMLBShadowQuarantinedGradingPayload,
  type MLBShadowQuarantinedPredictionPayload,
  type MLBShadowQuarantinedOutcomePayload,
  type MLBShadowQuarantinedGradingPayload,
} from '@/prediction/mlb/mlb-shadow-monitoring-quarantine-contract';

const VALID_HASH = 'a'.repeat(64);
const VALID_TIMESTAMP = '2024-06-15T18:40:00Z';

function buildValidPredictionPayload(
  overrides: Record<string, unknown> = {},
): unknown {
  return {
    shadowRecordId: 'shadow-001',
    gamePk: 775747,
    predictedWinner: 'HOME',
    predictedSide: 'HOME',
    homeWinProbability: 0.6,
    awayWinProbability: 0.4,
    decisionPolicy: 'MAX_PROBABILITY',
    predictionGeneratedAt: VALID_TIMESTAMP,
    payloadHash: VALID_HASH,
    ...overrides,
  };
}

function buildValidOutcomePayload(
  overrides: Record<string, unknown> = {},
): unknown {
  return {
    shadowRecordId: 'shadow-001',
    gamePk: 775747,
    officialWinner: 'HOME',
    winningTeamId: '147',
    homeScore: 5,
    awayScore: 3,
    resultObservedAt: VALID_TIMESTAMP,
    payloadHash: VALID_HASH,
    ...overrides,
  };
}

function buildValidGradingPayload(
  overrides: Record<string, unknown> = {},
): unknown {
  return {
    shadowRecordId: 'shadow-001',
    gamePk: 775747,
    candidateCorrectness: true,
    logLossContribution: 0.51,
    brierContribution: 0.16,
    gradedAt: VALID_TIMESTAMP,
    ...overrides,
  };
}

describe('mlb-shadow-monitoring-quarantine-contract', () => {
  describe('validateMLBShadowQuarantinedPredictionPayload', () => {
    /* 1. valid prediction payload accepted */
    it('accepts a valid prediction payload', () => {
      const payload = buildValidPredictionPayload();
      const result = validateMLBShadowQuarantinedPredictionPayload(payload);
      if (!result.ok) {
        throw new Error(
          `expected ok, got issues: ${JSON.stringify(result.issues)}`,
        );
      }
      expect(result.value.shadowRecordId).toBe('shadow-001');
      expect(result.value.gamePk).toBe(775747);
      expect(result.value.predictedWinner).toBe('HOME');
      expect(result.value.predictedSide).toBe('HOME');
      expect(result.value.homeWinProbability).toBe(0.6);
      expect(result.value.awayWinProbability).toBe(0.4);
      expect(result.value.decisionPolicy).toBe('MAX_PROBABILITY');
      expect(result.value.predictionGeneratedAt).toBe(VALID_TIMESTAMP);
      expect(result.value.payloadHash).toBe(VALID_HASH);
    });

    /* 4. invalid probability range rejected */
    it('rejects homeWinProbability outside [0,1] range', () => {
      const payload = buildValidPredictionPayload({
        homeWinProbability: 1.5,
      });
      const result = validateMLBShadowQuarantinedPredictionPayload(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const probIssue = result.issues.find(
          (i) =>
            i.path === '$.homeWinProbability' &&
            i.code === 'INVALID_PROBABILITY',
        );
        expect(probIssue).toBeDefined();
      }
    });

    it('rejects awayWinProbability above 1', () => {
      const payload = buildValidPredictionPayload({
        awayWinProbability: 1.01,
      });
      const result = validateMLBShadowQuarantinedPredictionPayload(payload);
      expect(result.ok).toBe(false);
    });
  });

  describe('validateMLBShadowQuarantinedOutcomePayload', () => {
    /* 2. valid outcome payload accepted */
    it('accepts a valid outcome payload', () => {
      const payload = buildValidOutcomePayload();
      const result = validateMLBShadowQuarantinedOutcomePayload(payload);
      if (!result.ok) {
        throw new Error(
          `expected ok, got issues: ${JSON.stringify(result.issues)}`,
        );
      }
      expect(result.value.shadowRecordId).toBe('shadow-001');
      expect(result.value.gamePk).toBe(775747);
      expect(result.value.officialWinner).toBe('HOME');
      expect(result.value.winningTeamId).toBe('147');
      expect(result.value.homeScore).toBe(5);
      expect(result.value.awayScore).toBe(3);
      expect(result.value.resultObservedAt).toBe(VALID_TIMESTAMP);
      expect(result.value.payloadHash).toBe(VALID_HASH);
    });

    /* 5. malformed score/result rejected */
    it('rejects non-integer homeScore', () => {
      const payload = buildValidOutcomePayload({
        homeScore: 'five',
      });
      const result = validateMLBShadowQuarantinedOutcomePayload(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const scoreIssue = result.issues.find(
          (i) => i.path === '$.homeScore' && i.code === 'INVALID_INTEGER',
        );
        expect(scoreIssue).toBeDefined();
      }
    });

    it('rejects negative awayScore', () => {
      const payload = buildValidOutcomePayload({
        awayScore: -2,
      });
      const result = validateMLBShadowQuarantinedOutcomePayload(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const scoreIssue = result.issues.find(
          (i) => i.path === '$.awayScore' && i.code === 'INVALID_INTEGER',
        );
        expect(scoreIssue).toBeDefined();
      }
    });
  });

  describe('validateMLBShadowQuarantinedGradingPayload', () => {
    /* 3. valid grading payload accepted */
    it('accepts a valid grading payload', () => {
      const payload = buildValidGradingPayload();
      const result = validateMLBShadowQuarantinedGradingPayload(payload);
      if (!result.ok) {
        throw new Error(
          `expected ok, got issues: ${JSON.stringify(result.issues)}`,
        );
      }
      expect(result.value.shadowRecordId).toBe('shadow-001');
      expect(result.value.gamePk).toBe(775747);
      expect(result.value.candidateCorrectness).toBe(true);
      expect(result.value.logLossContribution).toBe(0.51);
      expect(result.value.brierContribution).toBe(0.16);
      expect(result.value.gradedAt).toBe(VALID_TIMESTAMP);
    });

    /* 6. malformed grading metrics rejected */
    it('rejects non-numeric logLossContribution', () => {
      const payload = buildValidGradingPayload({
        logLossContribution: 'not-a-number',
      });
      const result = validateMLBShadowQuarantinedGradingPayload(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const metricIssue = result.issues.find(
          (i) =>
            i.path === '$.logLossContribution' &&
            i.code === 'INVALID_NUMBER',
        );
        expect(metricIssue).toBeDefined();
      }
    });

    it('rejects non-numeric brierContribution', () => {
      const payload = buildValidGradingPayload({
        brierContribution: 'oops',
      });
      const result = validateMLBShadowQuarantinedGradingPayload(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const metricIssue = result.issues.find(
          (i) =>
            i.path === '$.brierContribution' &&
            i.code === 'INVALID_NUMBER',
        );
        expect(metricIssue).toBeDefined();
      }
    });
  });

  describe('payload identity', () => {
    /* 7. payload identity mismatch rejected where applicable */
    it('rejects payloadHash that is not a 64-char lowercase hex string', () => {
      const payload = buildValidPredictionPayload({
        payloadHash: 'deadbeef',
      });
      const result = validateMLBShadowQuarantinedPredictionPayload(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const hashIssue = result.issues.find(
          (i) => i.path === '$.payloadHash' && i.code === 'INVALID_HASH',
        );
        expect(hashIssue).toBeDefined();
      }
    });
  });

  describe('operational contract isolation', () => {
    /* 8. each sensitive payload fails the ordinary operational validator */
    it('prediction payload fails operational validator', () => {
      const payload = buildValidPredictionPayload();
      const result = validateMLBShadowMonitoringOperationalRecord(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const probIssue = result.issues.find(
          (i) =>
            i.code === 'PROHIBITED_FIELD' &&
            (i.path === '$.homeWinProbability' ||
              i.path === '$.awayWinProbability'),
        );
        expect(probIssue).toBeDefined();
      }
    });

    it('outcome payload fails operational validator', () => {
      const payload = buildValidOutcomePayload();
      const result = validateMLBShadowMonitoringOperationalRecord(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const scoreIssue = result.issues.find(
          (i) =>
            i.code === 'PROHIBITED_FIELD' &&
            (i.path === '$.homeScore' || i.path === '$.awayScore'),
        );
        expect(scoreIssue).toBeDefined();
      }
    });

    it('grading payload fails operational validator', () => {
      const payload = buildValidGradingPayload();
      const result = validateMLBShadowMonitoringOperationalRecord(payload);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        const gradingIssue = result.issues.find(
          (i) =>
            i.code === 'PROHIBITED_FIELD' &&
            (i.path === '$.candidateCorrectness' ||
              i.path === '$.logLossContribution' ||
              i.path === '$.brierContribution'),
        );
        expect(gradingIssue).toBeDefined();
      }
    });

    /* 9. no sensitive contract is misclassified as scientific holdout evidence */
    it('quarantine payloads are not marked isProspectiveHoldoutEvidence', () => {
      // The quarantine types have no scientificUse / isProspectiveHoldoutEvidence
      // fields at all, so they cannot be misclassified as holdout evidence.
      const predictionPayload = buildValidPredictionPayload();
      const result = validateMLBShadowQuarantinedPredictionPayload(
        predictionPayload,
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect('isProspectiveHoldoutEvidence' in result.value).toBe(false);
        expect('scientificUse' in result.value).toBe(false);
      }

      const outcomePayload = buildValidOutcomePayload();
      const outcomeResult = validateMLBShadowQuarantinedOutcomePayload(
        outcomePayload,
      );
      expect(outcomeResult.ok).toBe(true);
      if (outcomeResult.ok) {
        expect('isProspectiveHoldoutEvidence' in outcomeResult.value).toBe(
          false,
        );
        expect('scientificUse' in outcomeResult.value).toBe(false);
      }

      const gradingPayload = buildValidGradingPayload();
      const gradingResult = validateMLBShadowQuarantinedGradingPayload(
        gradingPayload,
      );
      expect(gradingResult.ok).toBe(true);
      if (gradingResult.ok) {
        expect('isProspectiveHoldoutEvidence' in gradingResult.value).toBe(
          false,
        );
        expect('scientificUse' in gradingResult.value).toBe(false);
      }
    });
  });
});
