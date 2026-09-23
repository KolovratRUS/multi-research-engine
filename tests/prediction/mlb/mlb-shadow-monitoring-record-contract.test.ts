import { describe, expect, it } from 'vitest';
import {
  MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION,
  MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
  MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
  validateMLBShadowMonitoringOperationalRecord,
  type MLBShadowMonitoringOperationalRecordIssue,
} from '@/prediction/mlb/mlb-shadow-monitoring-record-contract';

function buildValidOperationalRecord(
  overrides: Record<string, unknown> = {},
): unknown {
  return {
    contractVersion: MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION,
    mode: MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
    scientificUse: MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
    isProspectiveHoldoutEvidence: false,
    eligibleForFutureValidation: false,
    eligibleForFutureTest: false,
    shadowRecordId: 'shadow-001',
    gamePk: 775747,
    officialDate: '2024-06-15',
    scheduledStartAt: '2024-06-15T19:10:00Z',
    predictionGeneratedAt: '2024-06-15T18:40:00Z',
    pipelineStatus: 'COMPLETE',
    failureCode: null,
    latencyMs: 42,
    sourceCandidateRecipeId: 'candidate-003',
    sourceCandidateFingerprint: 'abc123def456',
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featureManifestFingerprint: 'def456abc123',
    timingReferenceContractVersion: 'mlb-prospective-holdout-protocol-v1',
    timingReferenceCutoffAt: '2024-06-15T18:40:00Z',
    predictionPayloadGenerated: true,
    predictionPayloadSchemaValid: true,
    resultFetchSucceeded: true,
    resultJoinMatched: true,
    resultPayloadSchemaValid: true,
    gradingRecordProduced: true,
    gradingSchemaValid: true,
    ...overrides,
  };
}

function getIssues(
  record: unknown,
): readonly MLBShadowMonitoringOperationalRecordIssue[] {
  const result = validateMLBShadowMonitoringOperationalRecord(record);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    return result.issues;
  }
  throw new Error('expected validation failure');
}

describe('mlb-shadow-monitoring-record-contract', () => {
  describe('validateMLBShadowMonitoringOperationalRecord', () => {
    /* 1. valid operational record accepted */
    it('accepts a valid operational record', () => {
      const record = buildValidOperationalRecord();
      const result = validateMLBShadowMonitoringOperationalRecord(record);
      if (!result.ok) {
        throw new Error(
          `expected ok, got issues: ${JSON.stringify(result.issues)}`,
        );
      }
      expect(result.value.contractVersion).toBe(
        MLB_SHADOW_MONITORING_OPERATIONAL_RECORD_CONTRACT_VERSION,
      );
      expect(result.value.mode).toBe(
        MLB_SHADOW_MONITORING_OPERATIONAL_MODE_S1_OPERATIONAL_BLIND,
      );
      expect(result.value.scientificUse).toBe(
        MLB_SHADOW_MONITORING_SCIENTIFIC_USE_NONE,
      );
      expect(result.value.isProspectiveHoldoutEvidence).toBe(false);
      expect(result.value.eligibleForFutureValidation).toBe(false);
      expect(result.value.eligibleForFutureTest).toBe(false);
    });

    /* 2. wrong contract version rejected */
    it('rejects wrong contract version', () => {
      const record = buildValidOperationalRecord({
        contractVersion: 'mlb-shadow-monitoring-operational-record-v2',
      });
      const issues = getIssues(record);
      const versionIssue = issues.find(
        (i) =>
          i.path === '$.contractVersion' &&
          i.code === 'IDENTITY_MISMATCH',
      );
      expect(versionIssue).toBeDefined();
    });

    /* 3. wrong mode rejected */
    it('rejects wrong mode', () => {
      const record = buildValidOperationalRecord({
        mode: 'S1_PROSPECTIVE_HOLDOUT',
      });
      const issues = getIssues(record);
      const modeIssue = issues.find(
        (i) => i.path === '$.mode' && i.code === 'IDENTITY_MISMATCH',
      );
      expect(modeIssue).toBeDefined();
    });

    /* 4. scientificUse other than NONE rejected */
    it('rejects scientificUse other than NONE', () => {
      const record = buildValidOperationalRecord({
        scientificUse: 'HISTORICAL_ANALYSIS',
      });
      const issues = getIssues(record);
      const sciIssue = issues.find(
        (i) => i.path === '$.scientificUse' && i.code === 'IDENTITY_MISMATCH',
      );
      expect(sciIssue).toBeDefined();
    });

    /* 5. isProspectiveHoldoutEvidence=true rejected */
    it('rejects isProspectiveHoldoutEvidence=true', () => {
      const record = buildValidOperationalRecord({
        isProspectiveHoldoutEvidence: true,
      });
      const issues = getIssues(record);
      const holdoutIssue = issues.find(
        (i) =>
          i.path === '$.isProspectiveHoldoutEvidence' &&
          i.code === 'IDENTITY_MISMATCH',
      );
      expect(holdoutIssue).toBeDefined();
    });

    /* 6. eligibleForFutureValidation=true rejected */
    it('rejects eligibleForFutureValidation=true', () => {
      const record = buildValidOperationalRecord({
        eligibleForFutureValidation: true,
      });
      const issues = getIssues(record);
      const valIssue = issues.find(
        (i) =>
          i.path === '$.eligibleForFutureValidation' &&
          i.code === 'IDENTITY_MISMATCH',
      );
      expect(valIssue).toBeDefined();
    });

    /* 7. eligibleForFutureTest=true rejected */
    it('rejects eligibleForFutureTest=true', () => {
      const record = buildValidOperationalRecord({
        eligibleForFutureTest: true,
      });
      const issues = getIssues(record);
      const testIssue = issues.find(
        (i) =>
          i.path === '$.eligibleForFutureTest' &&
          i.code === 'IDENTITY_MISMATCH',
      );
      expect(testIssue).toBeDefined();
    });

    /* 8. actual prediction fields rejected */
    it('rejects prediction-sensitive fields (predictedWinner, predictedSide, predictedTeamId, homeWinProbability, awayWinProbability, decisionPolicy)', () => {
      const predictionFields: Record<string, unknown> = {
        predictedWinner: 'HOME',
        predictedSide: 'HOME',
        predictedTeamId: 147,
        homeWinProbability: 0.6,
        awayWinProbability: 0.4,
        decisionPolicy: 'MAX_PROBABILITY',
      };
      for (const [key, value] of Object.entries(predictionFields)) {
        const record = buildValidOperationalRecord({ [key]: value });
        const issues = getIssues(record);
        const fieldIssue = issues.find(
          (i) =>
            i.path === `$.${key}` && i.code === 'PROHIBITED_FIELD',
        );
        expect(fieldIssue).toBeDefined();
      }
    });

    /* 9. actual outcome fields rejected */
    it('rejects outcome-sensitive fields (officialWinner, winningTeamId, losingTeamId, winner, loser, finalScore, homeScore, awayScore)', () => {
      const outcomeFields: Record<string, unknown> = {
        officialWinner: 'HOME',
        winningTeamId: 147,
        losingTeamId: 148,
        winner: 'HOME',
        loser: 'AWAY',
        finalScore: '5-3',
        homeScore: 5,
        awayScore: 3,
      };
      for (const [key, value] of Object.entries(outcomeFields)) {
        const record = buildValidOperationalRecord({ [key]: value });
        const issues = getIssues(record);
        const fieldIssue = issues.find(
          (i) =>
            i.path === `$.${key}` && i.code === 'PROHIBITED_FIELD',
        );
        expect(fieldIssue).toBeDefined();
      }
    });

    /* 10. correctness fields rejected */
    it('rejects correctness fields (candidateCorrectness)', () => {
      const record = buildValidOperationalRecord({
        candidateCorrectness: true,
      });
      const issues = getIssues(record);
      const fieldIssue = issues.find(
        (i) => i.path === '$.candidateCorrectness' && i.code === 'PROHIBITED_FIELD',
      );
      expect(fieldIssue).toBeDefined();
    });

    /* 11. log-loss/Brier fields rejected */
    it('rejects log-loss/Brier fields (logLoss, logLossContribution, brier, brierScore, brierContribution)', () => {
      const metricFields: Record<string, unknown> = {
        logLoss: 0.51,
        logLossContribution: 0.51,
        brier: 0.16,
        brierScore: 0.16,
        brierContribution: 0.16,
      };
      for (const [key, value] of Object.entries(metricFields)) {
        const record = buildValidOperationalRecord({ [key]: value });
        const issues = getIssues(record);
        const fieldIssue = issues.find(
          (i) =>
            i.path === `$.${key}` && i.code === 'PROHIBITED_FIELD',
        );
        expect(fieldIssue).toBeDefined();
      }
    });

    /* 12. aggregate performance fields rejected */
    it('rejects aggregate performance fields (accuracy, calibration, aggregate, performance, roi)', () => {
      const perfFields: Record<string, unknown> = {
        accuracy: 0.55,
        calibration: 0.02,
        aggregate: 0.53,
        performance: 'GOOD',
        roi: 1.2,
      };
      for (const [key, value] of Object.entries(perfFields)) {
        const record = buildValidOperationalRecord({ [key]: value });
        const issues = getIssues(record);
        const fieldIssue = issues.find(
          (i) =>
            i.path === `$.${key}` && i.code === 'PROHIBITED_FIELD',
        );
        expect(fieldIssue).toBeDefined();
      }
    });

    /* 13. malformed IDs/timestamps rejected consistent with repo conventions */
    it('rejects malformed shadowRecordId (whitespace)', () => {
      const record = buildValidOperationalRecord({
        shadowRecordId: '  shadow-001  ',
      });
      const issues = getIssues(record);
      const idIssue = issues.find(
        (i) => i.path === '$.shadowRecordId' && i.code === 'INVALID_STRING',
      );
      expect(idIssue).toBeDefined();
    });

    it('rejects malformed shadowRecordId (control char)', () => {
      const record = buildValidOperationalRecord({
        shadowRecordId: 'shadow-\x00-001',
      });
      const issues = getIssues(record);
      const idIssue = issues.find(
        (i) => i.path === '$.shadowRecordId' && i.code === 'INVALID_STRING',
      );
      expect(idIssue).toBeDefined();
    });

    it('rejects negative gamePk', () => {
      const record = buildValidOperationalRecord({
        gamePk: -1,
      });
      const issues = getIssues(record);
      const pkIssue = issues.find(
        (i) => i.path === '$.gamePk' && i.code === 'INVALID_INTEGER',
      );
      expect(pkIssue).toBeDefined();
    });

    it('rejects non-integer gamePk', () => {
      const record = buildValidOperationalRecord({
        gamePk: '775747',
      });
      const issues = getIssues(record);
      const pkIssue = issues.find(
        (i) => i.path === '$.gamePk' && i.code === 'INVALID_INTEGER',
      );
      expect(pkIssue).toBeDefined();
    });

    it('rejects malformed officialDate', () => {
      const record = buildValidOperationalRecord({
        officialDate: '2024/06/15',
      });
      const issues = getIssues(record);
      const dateIssue = issues.find(
        (i) => i.path === '$.officialDate' && i.code === 'INVALID_DATE',
      );
      expect(dateIssue).toBeDefined();
    });

    it('rejects invalid scheduledStartAt timestamp', () => {
      const record = buildValidOperationalRecord({
        scheduledStartAt: 'not-a-timestamp',
      });
      const issues = getIssues(record);
      const tsIssue = issues.find(
        (i) =>
          i.path === '$.scheduledStartAt' && i.code === 'INVALID_TIMESTAMP',
      );
      expect(tsIssue).toBeDefined();
    });

    it('rejects negative latencyMs', () => {
      const record = buildValidOperationalRecord({
        latencyMs: -5,
      });
      const issues = getIssues(record);
      const latIssue = issues.find(
        (i) => i.path === '$.latencyMs' && i.code === 'INVALID_INTEGER',
      );
      expect(latIssue).toBeDefined();
    });

    it('rejects predictionPayloadHash as prohibited field', () => {
      const record = buildValidOperationalRecord({
        predictionPayloadHash: 'a'.repeat(64),
      });
      const issues = getIssues(record);
      const hashIssue = issues.find(
        (i) =>
          i.path === '$.predictionPayloadHash' &&
          i.code === 'PROHIBITED_FIELD',
      );
      expect(hashIssue).toBeDefined();
    });

    it('rejects resultPayloadHash as prohibited field', () => {
      const record = buildValidOperationalRecord({
        resultPayloadHash: 'b'.repeat(64),
      });
      const issues = getIssues(record);
      const hashIssue = issues.find(
        (i) =>
          i.path === '$.resultPayloadHash' &&
          i.code === 'PROHIBITED_FIELD',
      );
      expect(hashIssue).toBeDefined();
    });

    /* 13b. null-valued payload hashes also prohibited */
    it('rejects predictionPayloadHash even with null value as prohibited field', () => {
      const record = buildValidOperationalRecord({
        predictionPayloadHash: null,
      });
      const issues = getIssues(record);
      const hashIssue = issues.find(
        (i) =>
          i.path === '$.predictionPayloadHash' &&
          i.code === 'PROHIBITED_FIELD',
      );
      expect(hashIssue).toBeDefined();
    });

    it('rejects resultPayloadHash even with null value as prohibited field', () => {
      const record = buildValidOperationalRecord({
        resultPayloadHash: null,
      });
      const issues = getIssues(record);
      const hashIssue = issues.find(
        (i) =>
          i.path === '$.resultPayloadHash' &&
          i.code === 'PROHIBITED_FIELD',
      );
      expect(hashIssue).toBeDefined();
    });

    /* 14. unknown fields fail-closed */
    it('rejects unknown fields (fail-closed strict allowlist)', () => {
      const record = buildValidOperationalRecord({
        unknownField: 'secret',
      });
      const issues = getIssues(record);
      const unknownIssue = issues.find(
        (i) => i.path === '$.unknownField' && i.code === 'UNKNOWN_FIELD',
      );
      expect(unknownIssue).toBeDefined();
    });

    it('rejects multiple unknown fields simultaneously', () => {
      const record = buildValidOperationalRecord({
        extraData: 123,
        anotherUnknown: true,
      });
      const issues = getIssues(record);
      const extraIssue = issues.find(
        (i) => i.path === '$.extraData' && i.code === 'UNKNOWN_FIELD',
      );
      const anotherIssue = issues.find(
        (i) =>
          i.path === '$.anotherUnknown' && i.code === 'UNKNOWN_FIELD',
      );
      expect(extraIssue).toBeDefined();
      expect(anotherIssue).toBeDefined();
    });

    /* 15. sensitive nested field behavior tested */
    it('rejects predictionPayloadHash nested under a known fingerprint field', () => {
      const record = buildValidOperationalRecord({
        // featureManifestFingerprint is a known non-sensitive field;
        // hiding predictionPayloadHash inside its value must still be
        // caught by the recursive denylist scan.
        featureManifestFingerprint: {
          predictionPayloadHash: 'a'.repeat(64),
          predictedWinner: 'HOME',
        },
      });
      const issues = getIssues(record);
      const nestedHashIssue = issues.find(
        (i) =>
          i.path === '$.featureManifestFingerprint.predictionPayloadHash' &&
          i.code === 'PROHIBITED_FIELD',
      );
      const nestedSensitiveIssue = issues.find(
        (i) =>
          i.path === '$.featureManifestFingerprint.predictedWinner' &&
          i.code === 'PROHIBITED_FIELD',
      );
      expect(nestedHashIssue).toBeDefined();
      expect(nestedSensitiveIssue).toBeDefined();
    });

    it('rejects sensitive field nested under an unknown field value', () => {
      const record = buildValidOperationalRecord({
        metadata: {
          homeScore: 5,
          logLoss: 0.5,
        },
      });
      const issues = getIssues(record);
      const nestedHomeScore = issues.find(
        (i) =>
          i.path === '$.metadata.homeScore' &&
          i.code === 'PROHIBITED_FIELD',
      );
      const nestedLogLoss = issues.find(
        (i) =>
          i.path === '$.metadata.logLoss' &&
          i.code === 'PROHIBITED_FIELD',
      );
      expect(nestedHomeScore).toBeDefined();
      expect(nestedLogLoss).toBeDefined();
    });
  });
});
