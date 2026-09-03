import { describe, expect, it } from 'vitest';

import {
  MLB_PROSPECTIVE_HOLDOUT_PROGRESS_REPORT_CONTRACT_VERSION,
  type MLBProspectiveHoldoutProgressReport,
  type MLBProspectiveHoldoutProgressReportError,
  buildMLBProspectiveHoldoutProgressReport,
} from '@/prediction/mlb/mlb-prospective-holdout-progress-report';
import {
  MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
} from '@/prediction/mlb/mlb-prospective-holdout-protocol-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STABLE_ORDER_POLICY,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_VALIDATION_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_SIDE_DATE_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_TEST_AUTHORIZATION_RULE,
  MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_STORE_VERSION,
  type MLBProspectiveHoldoutActivationPersisted,
} from '@/prediction/mlb/mlb-prospective-holdout-activation-contract';
import {
  MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
  MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
  MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
} from '@/prediction/mlb/mlb-inner-development-third-real-candidate-recipe';
import {
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
  MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
  type MLBProspectivePregameEvidence,
  type MLBProspectivePregameEvidencePrepared,
  type MLBProspectivePregameEvidenceReceipt,
  computeArtifactId,
} from '@/prediction/mlb/mlb-prospective-pregame-evidence-artifact-contract';
import {
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
  MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_STORE_VERSION,
  type MLBProspectiveHoldoutGameIdentityBinding,
} from '@/prediction/mlb/mlb-prospective-holdout-game-identity-binding-contract';
import {
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  type MLBCanonicalPregameSnapshot,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  MLB_FEATURE_VECTOR_CONTRACT_VERSION,
  type MLBFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  type MLBProspectiveT360T360Validation,
} from '@/prediction/mlb/mlb-prospective-t360-capture-contract';
import {
  type MLBProspectiveHoldoutArtifactDiscoverySuccess,
  type MLBProspectiveHoldoutArtifactDiscoveryCandidate,
  type MLBProspectiveHoldoutArtifactEvidenceRecord,
  type MLBProspectiveHoldoutArtifactRescheduleConflict,
} from '@/prediction/mlb/mlb-prospective-holdout-artifact-discovery';

/* -------------------------------------------------------------------------- */
/*  Real J candidate fixtures                                                  */
/* -------------------------------------------------------------------------- */

const BASE_SNAPSHOT: MLBCanonicalPregameSnapshot = {
  contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
  sport: 'MLB',
  target: 'OFFICIAL_FINAL_GAME_WINNER',
  snapshotId: 'snapshot-1',
  capturedAt: '2026-07-15T00:00:00Z',
  dataCutoffAt: '2026-07-15T00:00:00Z',
  game: {
    gameId: 'game-1',
    scheduledStartAt: '2026-07-15T12:00:00Z',
    officialDate: '2026-07-15',
    season: 2026,
    gameType: 'REGULAR_SEASON',
    status: 'SCHEDULED',
    homeTeamId: 'home-team',
    awayTeamId: 'away-team',
    venueId: null,
    neutralSite: null,
    doubleheader: null,
  },
  startingPitchers: {
    home: { state: 'CONFIRMED', pitcherId: null, announcedAt: null, sourceRefIds: [] },
    away: { state: 'CONFIRMED', pitcherId: null, announcedAt: null, sourceRefIds: [] },
  },
  sourceReferences: [],
  sections: [],
  dataCompleteness: 'COMPLETE',
  warnings: [],
};

function buildBaseFeatureVector(
  snapshotId: string,
  gameId: string,
  officialDate: string,
): MLBFeatureVector {
  return {
    contractVersion: MLB_FEATURE_VECTOR_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'manifest-1',
    snapshotId,
    gameId,
    officialDate,
    dataCutoffAt: '2026-07-15T00:00:00Z',
    values: [],
  };
}

const BASE_T360_VALIDATION: MLBProspectiveT360T360Validation = {
  status: 'ACCEPTED',
  actualDataCutoffAtLteScientificCutoff: true,
  sourceTimestampsProvenLteScientificCutoff: true,
};

type PreparedEvidenceFixtureOverrides = Readonly<{
  gameId?: string;
  snapshotId?: string;
  officialDate?: string;
  scheduledStartAt?: string;
  scientificCutoffAt?: string;
  actualDataCutoffAt?: string;
}>;

function buildPreparedEvidence(
  overrides: PreparedEvidenceFixtureOverrides = {},
): MLBProspectivePregameEvidencePrepared {
  const snapshot = BASE_SNAPSHOT;
  const base: MLBProspectivePregameEvidencePrepared = {
    contractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    gameId: snapshot.game.gameId,
    snapshotId: snapshot.snapshotId,
    officialDate: snapshot.game.officialDate,
    scheduledStartAt: snapshot.game.scheduledStartAt,
    scientificCutoffAt: '2026-07-15T00:00:00Z',
    actualDataCutoffAt: snapshot.dataCutoffAt,
    rawSnapshot: snapshot,
    rawFeatureVector: buildBaseFeatureVector(snapshot.snapshotId, snapshot.game.gameId, snapshot.game.officialDate),
    candidate003CompatibleFeatureVector: buildBaseFeatureVector(snapshot.snapshotId, snapshot.game.gameId, snapshot.game.officialDate),
    t360Validation: BASE_T360_VALIDATION,
  };
  return {
    ...base,
    gameId: overrides.gameId ?? base.gameId,
    snapshotId: overrides.snapshotId ?? base.snapshotId,
    officialDate: overrides.officialDate ?? base.officialDate,
    scheduledStartAt: overrides.scheduledStartAt ?? base.scheduledStartAt,
    scientificCutoffAt: overrides.scientificCutoffAt ?? base.scientificCutoffAt,
    actualDataCutoffAt: overrides.actualDataCutoffAt ?? base.actualDataCutoffAt,
  };
}

type EvidenceFixtureOverrides = Readonly<{
  gameId?: string;
  officialDate?: string;
  scheduledStartAt?: string;
  activationId?: string;
}>;

function buildEvidence(
  overrides: EvidenceFixtureOverrides = {},
): MLBProspectivePregameEvidence {
  const prepared = buildPreparedEvidence();
  return {
    ...prepared,
    persistedAt: '2026-07-15T00:00:00Z',
    gameId: overrides.gameId ?? prepared.gameId,
    officialDate: overrides.officialDate ?? prepared.officialDate,
    scheduledStartAt: overrides.scheduledStartAt ?? prepared.scheduledStartAt,
    activationId: overrides.activationId ?? prepared.activationId,
  };
}

type BindingFixtureOverrides = Readonly<{
  gamePk?: number;
  gameId?: string;
  officialDate?: string;
  scheduledStartAt?: string;
  activationId?: string;
}>;

function buildBinding(
  overrides: BindingFixtureOverrides = {},
): MLBProspectiveHoldoutGameIdentityBinding {
  const base: MLBProspectiveHoldoutGameIdentityBinding = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_GAME_IDENTITY_BINDING_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    authoritativeSource: 'MLB_STATS_API_SCHEDULE_GAMEPK_V1',
    gamePk: 1,
    gameId: 'game-1',
    evidenceArtifactId: 'evidence-1',
    evidenceSha256: 'sha256',
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    snapshotId: 'snapshot-1',
    officialDate: '2026-07-15',
    scheduledStartAt: '2026-07-15T12:00:00Z',
    scientificCutoffAt: '2026-07-15T00:00:00Z',
    evidencePersistedAt: '2026-07-15T00:00:00Z',
    persistedAt: '2026-07-15T00:00:00Z',
  };
  return {
    ...base,
    gamePk: overrides.gamePk ?? base.gamePk,
    gameId: overrides.gameId ?? base.gameId,
    officialDate: overrides.officialDate ?? base.officialDate,
    scheduledStartAt: overrides.scheduledStartAt ?? base.scheduledStartAt,
    activationId: overrides.activationId ?? base.activationId,
  };
}

type CandidateFixtureOverrides = Readonly<{
  evidence?: EvidenceFixtureOverrides;
  binding?: BindingFixtureOverrides;
}>;

function buildCandidate(
  overrides: CandidateFixtureOverrides = {},
): MLBProspectiveHoldoutArtifactDiscoveryCandidate {
  const baseEvidence = buildEvidence(overrides.evidence);
  const baseBinding = buildBinding(overrides.binding);
  return {
    evidence: baseEvidence,
    binding: baseBinding,
  };
}

function buildValidationCandidates(
  count: number,
  gamePkStart = 100000,
): MLBProspectiveHoldoutArtifactDiscoveryCandidate[] {
  return Array.from({ length: count }, (_, index) => {
    const gamePk = gamePkStart + index;
    const gameId = `game-${gamePk}`;
    return buildCandidate({
      evidence: {
        gameId,
        officialDate: '2026-07-15',
        scheduledStartAt: '2026-07-15T12:00:00Z',
      },
      binding: {
        gamePk,
        gameId,
        officialDate: '2026-07-15',
        scheduledStartAt: '2026-07-15T12:00:00Z',
      },
    });
  });
}

function buildTestCandidates(
  count: number,
  gamePkStart = 200000,
): MLBProspectiveHoldoutArtifactDiscoveryCandidate[] {
  return Array.from({ length: count }, (_, index) => {
    const gamePk = gamePkStart + index;
    const gameId = `game-${gamePk}`;
    return buildCandidate({
      evidence: {
        gameId,
        officialDate: '2026-07-16',
        scheduledStartAt: '2026-07-16T12:00:00Z',
      },
      binding: {
        gamePk,
        gameId,
        officialDate: '2026-07-16',
        scheduledStartAt: '2026-07-16T12:00:00Z',
      },
    });
  });
}

type ActivationFixtureOverrides = Readonly<{
  validationBoundaryOfficialDate?: string;
  persistedAt?: string;
}>;

function buildFrozenActivation(
  overrides: ActivationFixtureOverrides = {},
): MLBProspectiveHoldoutActivationPersisted {
  const base: MLBProspectiveHoldoutActivationPersisted = {
    contractVersion: MLB_PROSPECTIVE_HOLDOUT_ACTIVATION_CONTRACT_VERSION,
    protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
    activationId: 'activation-900001',
    candidateRecipeId: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_ID,
    candidateFingerprint: MLB_INNER_DEVELOPMENT_THIRD_REAL_CANDIDATE_RECIPE_FINGERPRINT,
    featureManifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
    featurePolicyId: 'mlb-real-pregame-winner-feature-policy-v1',
    preprocessingPolicyId: 'raw-finite-feature-values-with-default-missing-v1',
    captureContractVersion: MLB_PROSPECTIVE_T360_CAPTURE_CONTRACT_VERSION,
    compatibilityLayerId: MLB_V1_CANDIDATE_003_T360_CAPTURE_COMPATIBILITY_V1,
    evidenceArtifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
    evidenceStoreVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
    validationBoundaryOfficialDate: '2026-07-15',
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
    persistedAt: '2026-07-15T04:00:00Z',
  };
  return {
    ...base,
    validationBoundaryOfficialDate: overrides.validationBoundaryOfficialDate ?? base.validationBoundaryOfficialDate,
    persistedAt: overrides.persistedAt ?? base.persistedAt,
  };
}

function buildEvidenceRecord(
  evidence: MLBProspectivePregameEvidence,
): MLBProspectiveHoldoutArtifactEvidenceRecord {
  return {
    evidence,
    receipt: {
      storeVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_STORE_VERSION,
      artifactContractVersion: MLB_PROSPECTIVE_PREGAME_EVIDENCE_ARTIFACT_CONTRACT_VERSION,
      artifactId: computeArtifactId(evidence),
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      activationId: evidence.activationId,
      gameId: evidence.gameId,
      snapshotId: evidence.snapshotId,
      relativePath: `var/mlb-development/mlb-prospective-pregame-evidence/${evidence.gameId}-${evidence.snapshotId}.json`,
      sha256: 'sha256',
      byteLength: 100,
      persistedAt: evidence.persistedAt,
    },
  };
}

function buildDiscoverySuccess(
  overrides: Partial<MLBProspectiveHoldoutArtifactDiscoverySuccess> = {},
): MLBProspectiveHoldoutArtifactDiscoverySuccess {
  return {
    ok: true,
    candidates: overrides.candidates ?? [],
    orphanEvidence: overrides.orphanEvidence ?? [],
    rescheduleConflicts: overrides.rescheduleConflicts ?? [],
    temporaryDebris: overrides.temporaryDebris ?? [],
    unknownFiles: overrides.unknownFiles ?? [],
    foreignArtifactSummary:
      overrides.foreignArtifactSummary ??
      { foreignEvidenceCount: 0, foreignBindingCount: 0 },
  };
}

function isError(
  result: MLBProspectiveHoldoutProgressReport | MLBProspectiveHoldoutProgressReportError,
): result is MLBProspectiveHoldoutProgressReportError {
  return 'kind' in result;
}

/* -------------------------------------------------------------------------- */
/*  Helper assertions                                                        */
/* -------------------------------------------------------------------------- */

const REPORT_KEYS = new Set([
  'activationId',
  'allCaptureComplete',
  'anomalies',
  'candidateFingerprint',
  'candidateRecipeId',
  'contractVersion',
  'protocolId',
  'resultIndependentSelection',
  'stableOrderPolicy',
  'testAuthorizationRule',
  'testCaptureComplete',
  'testCapturedCount',
  'testCapturedGamePks',
  'testRemainingCount',
  'testTargetCount',
  'totalCapturedCount',
  'totalRemainingCount',
  'totalTargetCount',
  'validationBoundaryOfficialDate',
  'validationCaptureComplete',
  'validationCapturedCount',
  'validationCapturedGamePks',
  'validationRemainingCount',
  'validationTargetCount',
]);

const ANOMALY_KEYS = new Set([
  'orphanEvidenceCount',
  'foreignEvidenceCount',
  'foreignBindingCount',
  'temporaryDebrisCount',
  'unknownFilesCount',
]);

function assertExactReportKeys(report: MLBProspectiveHoldoutProgressReport): void {
  const actualKeys = Object.getOwnPropertyNames(report).sort();
  const expectedKeys = Array.from(REPORT_KEYS).sort();
  expect(actualKeys).toEqual(expectedKeys);
}

function assertExactAnomalyKeys(report: MLBProspectiveHoldoutProgressReport): void {
  const actualKeys = Object.getOwnPropertyNames(report.anomalies).sort();
  const expectedKeys = Array.from(ANOMALY_KEYS).sort();
  expect(actualKeys).toEqual(expectedKeys);
}

/* -------------------------------------------------------------------------- */
/*  Tests                                                                     */
/* -------------------------------------------------------------------------- */

describe('mlb-prospective-holdout-progress-report', () => {
  // 1. exact report contract version
  it('1. reports exact contract version', () => {
    expect(MLB_PROSPECTIVE_HOLDOUT_PROGRESS_REPORT_CONTRACT_VERSION).toBe(
      'mlb-prospective-holdout-progress-report-v1',
    );
  });

  // 2. exact report own-key set
  it('2. success report has exact own-key set', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    assertExactReportKeys(result);
  });

  // 3. exact anomaly own-key set
  it('3. anomaly object has exact own-key set', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    assertExactAnomalyKeys(result);
  });

  // 4. zero candidates
  it('4. zero candidates produces zero-progress report', () => {
    const activation = buildFrozenActivation();
    const discovery = buildDiscoverySuccess();
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedCount).toBe(0);
    expect(result.testCapturedCount).toBe(0);
    expect(result.totalCapturedCount).toBe(0);
    expect(result.validationCapturedGamePks).toEqual([]);
    expect(result.testCapturedGamePks).toEqual([]);
    expect(result.validationRemainingCount).toBe(67);
    expect(result.testRemainingCount).toBe(69);
    expect(result.totalRemainingCount).toBe(136);
    expect(result.validationCaptureComplete).toBe(false);
    expect(result.testCaptureComplete).toBe(false);
    expect(result.allCaptureComplete).toBe(false);
  });

  // 5. one validation candidate
  it('5. one validation candidate increments validation side', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate({
      evidence: { officialDate: '2026-07-15', scheduledStartAt: '2026-07-15T12:00:00Z' },
      binding: { gamePk: 1001, officialDate: '2026-07-15', scheduledStartAt: '2026-07-15T12:00:00Z' },
    });
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedCount).toBe(1);
    expect(result.testCapturedCount).toBe(0);
    expect(result.validationCapturedGamePks).toEqual([1001]);
  });

  // 6. one test candidate
  it('6. one test candidate increments test side', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate({
      evidence: { officialDate: '2026-07-16', scheduledStartAt: '2026-07-16T12:00:00Z' },
      binding: { gamePk: 2001, officialDate: '2026-07-16', scheduledStartAt: '2026-07-16T12:00:00Z' },
    });
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedCount).toBe(0);
    expect(result.testCapturedCount).toBe(1);
    expect(result.testCapturedGamePks).toEqual([2001]);
  });

  // 7. candidate exactly on boundary date
  it('7. candidate exactly on boundary date counts as validation', () => {
    const activation = buildFrozenActivation({ validationBoundaryOfficialDate: '2026-07-15' });
    const candidate = buildCandidate({
      evidence: { officialDate: '2026-07-15', scheduledStartAt: '2026-07-15T12:00:00Z' },
      binding: { gamePk: 1001, officialDate: '2026-07-15', scheduledStartAt: '2026-07-15T12:00:00Z' },
    });
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedCount).toBe(1);
    expect(result.testCapturedCount).toBe(0);
  });

  // 8. mixed validation/test candidates
  it('8. mixed validation and test candidates split correctly', () => {
    const activation = buildFrozenActivation();
    const candidates = [
      buildCandidate({ evidence: { officialDate: '2026-07-14', scheduledStartAt: '2026-07-14T12:00:00Z' }, binding: { gamePk: 1, officialDate: '2026-07-14', scheduledStartAt: '2026-07-14T12:00:00Z' } }),
      buildCandidate({ evidence: { officialDate: '2026-07-15', scheduledStartAt: '2026-07-15T12:00:00Z' }, binding: { gamePk: 2, officialDate: '2026-07-15', scheduledStartAt: '2026-07-15T12:00:00Z' } }),
      buildCandidate({ evidence: { officialDate: '2026-07-16', scheduledStartAt: '2026-07-16T12:00:00Z' }, binding: { gamePk: 3, officialDate: '2026-07-16', scheduledStartAt: '2026-07-16T12:00:00Z' } }),
    ];
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedCount).toBe(2);
    expect(result.testCapturedCount).toBe(1);
    expect(result.validationCapturedGamePks).toEqual([1, 2]);
    expect(result.testCapturedGamePks).toEqual([3]);
  });

  // 9. classification uses officialDate, not derived scheduled-start date
  it('9. classification uses officialDate, not derived scheduled-start date', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate({
      evidence: { officialDate: '2026-07-15', scheduledStartAt: '2026-07-16T12:00:00Z' },
      binding: { gamePk: 1, officialDate: '2026-07-15', scheduledStartAt: '2026-07-16T12:00:00Z' },
    });
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedCount).toBe(1);
    expect(result.testCapturedCount).toBe(0);
  });

  // 10. deterministic scheduledStartAt ASC ordering
  it('10. candidates ordered by scheduledStartAt ASC', () => {
    const activation = buildFrozenActivation();
    const candidates = [
      buildCandidate({ evidence: { scheduledStartAt: '2026-07-16T12:00:00Z' }, binding: { gamePk: 2, scheduledStartAt: '2026-07-16T12:00:00Z' } }),
      buildCandidate({ evidence: { scheduledStartAt: '2026-07-15T12:00:00Z' }, binding: { gamePk: 1, scheduledStartAt: '2026-07-15T12:00:00Z' } }),
    ];
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedGamePks).toEqual([1, 2]);
  });

  // 11. gamePk tie-break ordering
  it('11. gamePk tie-break when scheduledStartAt equal', () => {
    const activation = buildFrozenActivation();
    const candidates = [
      buildCandidate({ evidence: { scheduledStartAt: '2026-07-15T12:00:00Z' }, binding: { gamePk: 3, scheduledStartAt: '2026-07-15T12:00:00Z' } }),
      buildCandidate({ evidence: { scheduledStartAt: '2026-07-15T12:00:00Z' }, binding: { gamePk: 1, scheduledStartAt: '2026-07-15T12:00:00Z' } }),
      buildCandidate({ evidence: { scheduledStartAt: '2026-07-15T12:00:00Z' }, binding: { gamePk: 2, scheduledStartAt: '2026-07-15T12:00:00Z' } }),
    ];
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedGamePks).toEqual([1, 2, 3]);
  });

  // 12. input candidate array not mutated
  it('12. input candidate array is not mutated', () => {
    const activation = buildFrozenActivation();
    const candidates = [
      buildCandidate({ evidence: { scheduledStartAt: '2026-07-16T12:00:00Z' }, binding: { gamePk: 2, scheduledStartAt: '2026-07-16T12:00:00Z' } }),
      buildCandidate({ evidence: { scheduledStartAt: '2026-07-15T12:00:00Z' }, binding: { gamePk: 1, scheduledStartAt: '2026-07-15T12:00:00Z' } }),
    ];
    const original = candidates.slice();
    const discovery = buildDiscoverySuccess({ candidates });
    buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(candidates).toEqual(original);
  });

  // 13. orphan evidence excluded from counts
  it('13. orphan evidence excluded from captured counts', () => {
    const activation = buildFrozenActivation();
    const orphan = buildCandidate({ evidence: { gameId: 'orphan-game' }, binding: { gamePk: 9999 } });
    const discovery = buildDiscoverySuccess({
      candidates: [orphan],
      orphanEvidence: [buildEvidenceRecord(orphan.evidence)],
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.totalCapturedCount).toBe(1);
    expect(result.anomalies.orphanEvidenceCount).toBe(1);
  });

  // 14. orphan evidence anomaly count
  it('14. orphan evidence anomaly count is correct (with candidates)', () => {
    const activation = buildFrozenActivation();
    const orphan = buildCandidate({ evidence: { gameId: 'orphan' }, binding: { gamePk: 9998 } });
    const discovery = buildDiscoverySuccess({
      candidates: [orphan],
      orphanEvidence: [buildEvidenceRecord(orphan.evidence), buildEvidenceRecord(buildCandidate().evidence)],
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.anomalies.orphanEvidenceCount).toBe(2);
  });

  // 15. foreign evidence excluded from counts
  it('15. foreign evidence excluded from captured counts', () => {
    const activation = buildFrozenActivation();
    const foreign = buildCandidate({ evidence: { activationId: 'other-activation' }, binding: { activationId: 'other-activation' } });
    const discovery = buildDiscoverySuccess({
      candidates: [foreign],
      foreignArtifactSummary: { foreignEvidenceCount: 1, foreignBindingCount: 0 },
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.totalCapturedCount).toBe(1);
    expect(result.anomalies.foreignEvidenceCount).toBe(1);
  });

  // 16. foreign evidence anomaly count
  it('16. foreign evidence anomaly count is correct', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({
      candidates: [candidate],
      foreignArtifactSummary: { foreignEvidenceCount: 3, foreignBindingCount: 2 },
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.anomalies.foreignEvidenceCount).toBe(3);
    expect(result.anomalies.foreignBindingCount).toBe(2);
  });

  // 17. foreign binding excluded from counts
  it('17. foreign binding excluded from captured counts', () => {
    const activation = buildFrozenActivation();
    const foreign = buildCandidate({ evidence: { activationId: 'other-activation' }, binding: { activationId: 'other-activation' } });
    const discovery = buildDiscoverySuccess({
      candidates: [foreign],
      foreignArtifactSummary: { foreignEvidenceCount: 0, foreignBindingCount: 1 },
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.totalCapturedCount).toBe(1);
    expect(result.anomalies.foreignBindingCount).toBe(1);
  });

  // 18. foreign binding anomaly count
  it('18. foreign binding anomaly count is correct', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({
      candidates: [candidate],
      foreignArtifactSummary: { foreignEvidenceCount: 0, foreignBindingCount: 4 },
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.anomalies.foreignBindingCount).toBe(4);
  });

  // 19. temporary debris anomaly count
  it('19. temporary debris anomaly count is correct', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({
      candidates: [candidate],
      temporaryDebris: ['a.tmp', 'b.tmp'],
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.anomalies.temporaryDebrisCount).toBe(2);
  });

  // 20. unknown files anomaly count
  it('20. unknown files anomaly count is correct', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({
      candidates: [candidate],
      unknownFiles: ['README.txt', 'other.dat'],
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.anomalies.unknownFilesCount).toBe(2);
  });

  // 21. all allowed anomalies may coexist with valid progress
  it('21. all allowed anomalies may coexist with valid progress', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const orphan = buildCandidate({ evidence: { gameId: 'orphan' }, binding: { gamePk: 9998 } });
    const discovery = buildDiscoverySuccess({
      candidates: [candidate],
      orphanEvidence: [buildEvidenceRecord(orphan.evidence)],
      foreignArtifactSummary: { foreignEvidenceCount: 1, foreignBindingCount: 1 },
      temporaryDebris: ['a.tmp'],
      unknownFiles: ['README.txt'],
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.totalCapturedCount).toBe(1);
    expect(result.anomalies.orphanEvidenceCount).toBe(1);
    expect(result.anomalies.foreignEvidenceCount).toBe(1);
    expect(result.anomalies.foreignBindingCount).toBe(1);
    expect(result.anomalies.temporaryDebrisCount).toBe(1);
    expect(result.anomalies.unknownFilesCount).toBe(1);
  });

  // 22. reschedule conflict → PROGRESS_INTEGRITY_CONFLICT
  it('22. reschedule conflict returns PROGRESS_INTEGRITY_CONFLICT', () => {
    const activation = buildFrozenActivation();
    const conflict: MLBProspectiveHoldoutArtifactRescheduleConflict = {
      activationId: 'activation-900001',
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      gamePk: 900001,
      bindingIds: ['b1'],
      evidenceArtifactIds: ['e1'],
      scheduledStartAts: ['2026-07-15T12:00:00Z'],
      officialDates: ['2026-07-15'],
    };
    const discovery = buildDiscoverySuccess({
      rescheduleConflicts: [conflict],
      candidates: [buildCandidate()],
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.kind).toBe('PROGRESS_INTEGRITY_CONFLICT');
  });

  // 23. reschedule conflict never produces success report even with candidates
  it('23. reschedule conflict never produces success report even with candidates', () => {
    const activation = buildFrozenActivation();
    const conflict: MLBProspectiveHoldoutArtifactRescheduleConflict = {
      activationId: 'activation-900001',
      protocolId: MLB_PROSPECTIVE_HOLDOUT_PROTOCOL_ID,
      gamePk: 900001,
      bindingIds: ['b1'],
      evidenceArtifactIds: ['e1'],
      scheduledStartAts: ['2026-07-15T12:00:00Z'],
      officialDates: ['2026-07-15'],
    };
    const discovery = buildDiscoverySuccess({
      rescheduleConflicts: [conflict],
      candidates: [buildCandidate()],
    });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.kind).toBe('PROGRESS_INTEGRITY_CONFLICT');
  });

  // 24. validation captured > target → CAPTURE_COUNT_EXCEEDS_TARGET
  it('24. validation captured > target returns CAPTURE_COUNT_EXCEEDS_TARGET', () => {
    const activation = buildFrozenActivation();
    const candidates = buildValidationCandidates(68);
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.kind).toBe('CAPTURE_COUNT_EXCEEDS_TARGET');
  });

  // 25. test captured > target → CAPTURE_COUNT_EXCEEDS_TARGET
  it('25. test captured > target returns CAPTURE_COUNT_EXCEEDS_TARGET', () => {
    const activation = buildFrozenActivation();
    const candidates = buildTestCandidates(70);
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.kind).toBe('CAPTURE_COUNT_EXCEEDS_TARGET');
  });

  // 26. validation exactly target → validation complete
  it('26. validation exactly target makes validation complete', () => {
    const activation = buildFrozenActivation();
    const candidates = buildValidationCandidates(67);
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedCount).toBe(67);
    expect(result.validationRemainingCount).toBe(0);
    expect(result.validationCaptureComplete).toBe(true);
  });

  // 27. test exactly target → test complete
  it('27. test exactly target makes test complete', () => {
    const activation = buildFrozenActivation();
    const candidates = buildTestCandidates(69);
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.testCapturedCount).toBe(69);
    expect(result.testRemainingCount).toBe(0);
    expect(result.testCaptureComplete).toBe(true);
  });

  // 28. both exactly target → all complete
  it('28. both exactly target makes all complete', () => {
    const activation = buildFrozenActivation();
    const candidates = [
      ...buildValidationCandidates(67),
      ...buildTestCandidates(69),
    ];
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCaptureComplete).toBe(true);
    expect(result.testCaptureComplete).toBe(true);
    expect(result.allCaptureComplete).toBe(true);
    expect(result.totalCapturedCount).toBe(136);
    expect(result.totalRemainingCount).toBe(0);
  });

  // 29. one side complete does not imply all complete
  it('29. one side complete does not imply all complete', () => {
    const activation = buildFrozenActivation();
    const candidates = [
      ...buildValidationCandidates(67),
      ...buildTestCandidates(1),
    ];
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCaptureComplete).toBe(true);
    expect(result.testCaptureComplete).toBe(false);
    expect(result.allCaptureComplete).toBe(false);
  });

  // 30. remaining arithmetic exact
  it('30. remaining arithmetic is exact', () => {
    const activation = buildFrozenActivation();
    const candidates = [
      ...buildValidationCandidates(1),
      ...buildTestCandidates(1),
    ];
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationRemainingCount).toBe(66);
    expect(result.testRemainingCount).toBe(68);
    expect(result.totalRemainingCount).toBe(134);
  });

  // 31. total target arithmetic exact
  it('31. total target arithmetic is exact', () => {
    const activation = buildFrozenActivation();
    const discovery = buildDiscoverySuccess();
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.totalTargetCount).toBe(136);
  });

  // 32. total captured arithmetic exact
  it('32. total captured arithmetic is exact', () => {
    const activation = buildFrozenActivation();
    const candidates = Array.from({ length: 3 }, (_, i) =>
      buildCandidate({
        evidence: { officialDate: i < 2 ? '2026-07-15' : '2026-07-16', scheduledStartAt: `2026-07-${15 + (i < 2 ? 0 : 1)}T12:00:00Z` },
        binding: { gamePk: i + 1, officialDate: i < 2 ? '2026-07-15' : '2026-07-16', scheduledStartAt: `2026-07-${15 + (i < 2 ? 0 : 1)}T12:00:00Z` },
      }),
    );
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result.validationCapturedCount).toBe(2);
    expect(result.testCapturedCount).toBe(1);
    expect(result.totalCapturedCount).toBe(3);
  });

  // 33. no Math.max semantics / over-target fails
  it('33. over-target fails closed instead of clamping', () => {
    const activation = buildFrozenActivation();
    const candidates = buildValidationCandidates(68);
    const discovery = buildDiscoverySuccess({ candidates });
    const result = buildMLBProspectiveHoldoutProgressReport({ activation, discovery });
    expect(isError(result)).toBe(true);
    if (!isError(result)) return;
    expect(result.kind).toBe('CAPTURE_COUNT_EXCEEDS_TARGET');
  });

  // 34. observed gamePk arrays do not imply future cohort fields
  it('34. success report contains no future cohort fields', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({
      activation,
      discovery,
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result).not.toHaveProperty('validationGamePkCohort');
    expect(result).not.toHaveProperty('testGamePkCohort');
    expect(result).not.toHaveProperty('futureCandidates');
  });

  // 35. no reportedAt
  it('35. report contains no reportedAt field', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({
      activation,
      discovery,
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result).not.toHaveProperty('reportedAt');
  });

  // 36. no persistedAt
  it('36. report contains no persistedAt field', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({
      activation,
      discovery,
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    expect(result).not.toHaveProperty('persistedAt');
  });

  // 37. no result/label/odds fields
  it('37. report contains no result/label/odds fields', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({
      activation,
      discovery,
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    const prohibited = ['result', 'label', 'odds', 'sportsbook', 'winner', 'finalScore'];
    for (const key of prohibited) {
      expect(result).not.toHaveProperty(key);
    }
  });

  // Additional: verify exact own-key set on success
  it('verifies exact report own-key set on success', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({
      activation,
      discovery,
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    assertExactReportKeys(result);
  });

  // Additional: verify exact anomaly own-key set
  it('verifies exact anomaly own-key set on success', () => {
    const activation = buildFrozenActivation();
    const candidate = buildCandidate();
    const discovery = buildDiscoverySuccess({ candidates: [candidate] });
    const result = buildMLBProspectiveHoldoutProgressReport({
      activation,
      discovery,
    });
    expect(isError(result)).toBe(false);
    if (isError(result)) return;
    assertExactAnomalyKeys(result);
  });
});
