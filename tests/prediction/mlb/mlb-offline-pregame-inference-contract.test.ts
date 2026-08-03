import { describe, expect, it } from 'vitest';
import {
  MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION,
  MLB_OFFLINE_PREGAME_DECISION_POLICY,
  validateMLBOfflinePregameInference,
  inferMLBOfflinePregameWinner,
} from '@/prediction/mlb/mlb-offline-pregame-inference-contract';
import {
  validateMLBModelTestReleaseResult,
  validateMLBModelTestEvaluation,
  validateMLBModelReleaseRecord,
} from '@/prediction/mlb/mlb-model-test-release-contract';
import {
  validateMLBModelFitValidationResult,
} from '@/prediction/mlb/mlb-logistic-regression-fit-contract';
import {
  validateMLBFeatureManifest,
  validateMLBFeatureVector,
  extractMLBLeakageSafeFeatureVector,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  validateMLBCanonicalPregameSnapshot,
  MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
} from '@/prediction/mlb/mlb-pregame-snapshot-contract';
import {
  assertNoOddsContamination,
} from '@/prediction/firewall/odds-contamination-guard';
import { readFile } from 'node:fs/promises';

const FROZEN_CAPTURED_AT = '2026-07-15T10:00:00Z';
const FROZEN_DATA_CUTOFF = '2026-07-15T09:00:00Z';
const FROZEN_SCHEDULED_START = '2026-07-15T12:00:00Z';

function buildValidReleaseResult(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const baseModel = {
    contractVersion: 'mlb-deterministic-logistic-regression-model-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    intercept: 0,
    featureIds: ['p_1', 'p_2'],
    coefficients: [
      { featureId: 'p_1', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
      { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
    ],
    trainingRowCount: 2,
    iterationsCompleted: 1,
    converged: true,
    finalTrainingObjective: 0.693147,
  };

  const baseValidation = {
    contractVersion: 'mlb-model-validation-evaluation-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: 'model-1::validation-v1',
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    split: 'VALIDATION',
    rowCount: 2,
    metrics: {
      logLoss: 0.693147,
      brierScore: 0.25,
      rocAuc: 0.5,
    },
  };

  const baseTest = {
    contractVersion: 'mlb-model-test-evaluation-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    evaluationId: 'model-1::test-v1',
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    split: 'TEST',
    rowCount: 2,
    metrics: {
      logLoss: 0.693147,
      brierScore: 0.25,
      rocAuc: 0.5,
    },
  };

  const baseRelease = {
    contractVersion: 'mlb-model-release-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    releaseId: 'model-1::offline-release-candidate-v1',
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    datasetId: 'dataset-1',
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    validationEvaluationId: 'model-1::validation-v1',
    testEvaluationId: 'model-1::test-v1',
    configurationLockStatus: 'LOCKED_BEFORE_TEST_EVALUATION',
    testEvaluationPolicy: 'HELD_OUT_TEST_FINAL_EVALUATION_V1',
    releaseStatus: 'OFFLINE_RELEASE_CANDIDATE_NOT_DEPLOYED',
  };

  return {
    contractVersion: 'mlb-model-test-release-result-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    resultId: 'plan-1::test-release-v1',
    fitValidation: {
      contractVersion: 'mlb-model-fit-validation-result-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      resultId: 'plan-1::fit-validation-v1',
      model: { ...baseModel, ...(overrides.model ?? {}) },
      validation: { ...baseValidation, ...(overrides.validation ?? {}) },
    },
    test: { ...baseTest, ...(overrides.test ?? {}) },
    release: { ...baseRelease, ...(overrides.release ?? {}) },
  } as Record<string, unknown>;
}

function buildValidManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: 'mlb-feature-manifest-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    manifestId: 'manifest-1',
    features: [
      {
        featureId: 'p_1',
        sectionId: 'sec-1',
        payloadPath: ['home', 'p_1'],
        valueKind: 'NUMBER',
        missingPolicy: 'REJECT',
        defaultValue: null,
        ...((overrides.features as Record<string, unknown>[] | undefined)?.[0] ?? {}),
      },
      {
        featureId: 'p_2',
        sectionId: 'sec-1',
        payloadPath: ['away', 'p_2'],
        valueKind: 'NUMBER',
        missingPolicy: 'REJECT',
        defaultValue: null,
        ...((overrides.features as Record<string, unknown>[] | undefined)?.[1] ?? {}),
      },
    ],
    ...overrides,
  } as Record<string, unknown>;
}

function buildValidSnapshot(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: MLB_CANONICAL_PREGAME_SNAPSHOT_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    snapshotId: 'snapshot-1',
    capturedAt: FROZEN_CAPTURED_AT,
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    game: {
      gameId: 'game-1',
      scheduledStartAt: FROZEN_SCHEDULED_START,
      officialDate: '2026-07-15',
      season: 2026,
      gameType: 'REGULAR_SEASON',
      status: 'SCHEDULED',
      homeTeamId: 'home-1',
      awayTeamId: 'away-1',
      venueId: 'venue-1',
      neutralSite: false,
      doubleheader: null,
      ...(overrides.game as Record<string, unknown> | undefined ?? {}),
    },
    startingPitchers: {
      home: {
        state: 'PROBABLE',
        pitcherId: 'p-1',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        ...((overrides.startingPitchers as Record<string, Record<string, unknown>> | undefined)?.home ?? {}),
      },
      away: {
        state: 'PROBABLE',
        pitcherId: 'p-2',
        announcedAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-away'],
        ...((overrides.startingPitchers as Record<string, Record<string, unknown>> | undefined)?.away ?? {}),
      },
    },
    sourceReferences: [
      {
        sourceRefId: 'src-away',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['STARTING_PITCHER'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
      {
        sourceRefId: 'src-official',
        sourceName: 'MLB Stats API',
        sourceCategory: 'OFFICIAL',
        roles: ['GAME_IDENTITY'],
        providerRecordId: null,
        fetchedAt: FROZEN_CAPTURED_AT,
        sourceUpdatedAt: FROZEN_DATA_CUTOFF,
      },
    ],
    sections: [
      {
        sectionId: 'sec-1',
        kind: 'GAME_CONTEXT',
        entity: {
          scope: 'GAME',
          entityId: null,
        },
        status: 'AVAILABLE',
        asOfAt: FROZEN_DATA_CUTOFF,
        sourceRefIds: ['src-official'],
        payload: {
          home: { p_1: 1 },
          away: { p_2: 1 },
        },
        ...((overrides.sections as Record<string, unknown>[] | undefined)?.[0] ?? {}),
      },
    ],
    dataCompleteness: 'COMPLETE',
    warnings: [],
    ...overrides,
  } as Record<string, unknown>;
}

function buildMinimalValidInference(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    contractVersion: MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    inferenceId: 'release-1::snapshot-1::offline-pregame-inference-v1',
    releaseId: 'release-1',
    modelId: 'model-1',
    planId: 'plan-1',
    matrixId: 'matrix-1',
    configId: 'config-1',
    manifestId: 'manifest-1',
    snapshotId: 'snapshot-1',
    gameId: 'game-1',
    officialDate: '2026-07-15',
    dataCutoffAt: FROZEN_DATA_CUTOFF,
    algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    decisionPolicy: MLB_OFFLINE_PREGAME_DECISION_POLICY,
    homeTeamId: 'home-1',
    awayTeamId: 'away-1',
    probabilities: {
      homeWinProbability: 0.5,
      awayWinProbability: 0.5,
    },
    predictedSide: 'HOME',
    predictedTeamId: 'home-1',
    ...overrides,
  } as Record<string, unknown>;
}

function expectValidLockedInputs(
  releasedModelResult: unknown,
  featureManifest: unknown,
  snapshot: unknown,
): void {
  const releaseValidation = validateMLBModelTestReleaseResult(releasedModelResult);
  expect(releaseValidation.ok).toBe(true);
  if (releaseValidation.ok) {
    expect(validateMLBModelFitValidationResult(releaseValidation.value.fitValidation).ok).toBe(true);
    expect(validateMLBModelTestEvaluation(releaseValidation.value.test).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(releaseValidation.value.release).ok).toBe(true);
  }

  const manifestValidation = validateMLBFeatureManifest(featureManifest);
  expect(manifestValidation.ok).toBe(true);

  const snapshotValidation = validateMLBCanonicalPregameSnapshot(snapshot);
  expect(snapshotValidation.ok).toBe(true);
}

describe('mlb-offline-pregame-inference-contract', () => {
  it('accepts a minimal valid offline inference and returns the exact original reference', () => {
    const proposed = buildMinimalValidInference();
    const result = validateMLBOfflinePregameInference(proposed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(proposed);
    }
  });

  it('validates exact inference fields, literals, identities, date, cutoff, and deterministic inference ID', () => {
    const valid = buildMinimalValidInference();
    const result = validateMLBOfflinePregameInference(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION);
      expect(result.value.sport).toBe('MLB');
      expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
      expect(result.value.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
      expect(result.value.algorithm).toBe('L2_LOGISTIC_REGRESSION_BINARY_V1');
      expect(result.value.decisionPolicy).toBe(MLB_OFFLINE_PREGAME_DECISION_POLICY);
      expect(result.value.inferenceId).toBe('release-1::snapshot-1::offline-pregame-inference-v1');
      expect(result.value.officialDate).toBe('2026-07-15');
      expect(result.value.dataCutoffAt).toBe(FROZEN_DATA_CUTOFF);
      expect(result.value.predictedSide).toBe('HOME');
      expect(result.value.predictedTeamId).toBe('home-1');
    }
  });

  it('validates probability bounds, exact complement, finite values, and negative-zero rejection', () => {
    const base = buildMinimalValidInference();
    expect(validateMLBOfflinePregameInference(base)).toEqual(expect.objectContaining({ ok: true }));

    const invalidNegative = buildMinimalValidInference({
      probabilities: { homeWinProbability: -0.1, awayWinProbability: 1.1 },
    });
    expect(validateMLBOfflinePregameInference(invalidNegative).ok).toBe(false);

    const invalidNaN = buildMinimalValidInference({
      probabilities: { homeWinProbability: Number.NaN, awayWinProbability: Number.NaN },
    });
    expect(validateMLBOfflinePregameInference(invalidNaN).ok).toBe(false);

    const negativeZero = buildMinimalValidInference({
      probabilities: { homeWinProbability: -0, awayWinProbability: 1 - (-0) },
    });
    expect(validateMLBOfflinePregameInference(negativeZero).ok).toBe(false);

    const mismatch = buildMinimalValidInference({
      probabilities: { homeWinProbability: 0.7, awayWinProbability: 0.3 },
    });
    expect(validateMLBOfflinePregameInference(mismatch).ok).toBe(false);
  });

  it('validates decision-policy, predicted-side, and predicted-team consistency', () => {
    const homeWin = buildMinimalValidInference({
      probabilities: { homeWinProbability: 0.75, awayWinProbability: 0.25 },
      predictedSide: 'HOME',
      predictedTeamId: 'home-1',
    });
    expect(validateMLBOfflinePregameInference(homeWin).ok).toBe(true);

    const awayWin = buildMinimalValidInference({
      probabilities: { homeWinProbability: 0.25, awayWinProbability: 0.75 },
      predictedSide: 'AWAY',
      predictedTeamId: 'away-1',
    });
    expect(validateMLBOfflinePregameInference(awayWin).ok).toBe(true);

    const inconsistentSide = buildMinimalValidInference({
      probabilities: { homeWinProbability: 0.75, awayWinProbability: 0.25 },
      predictedSide: 'AWAY',
      predictedTeamId: 'away-1',
    });
    expect(validateMLBOfflinePregameInference(inconsistentSide).ok).toBe(false);

    const inconsistentTeam = buildMinimalValidInference({
      probabilities: { homeWinProbability: 0.25, awayWinProbability: 0.75 },
      predictedSide: 'AWAY',
      predictedTeamId: 'home-1',
    });
    expect(validateMLBOfflinePregameInference(inconsistentTeam).ok).toBe(false);
  });

  it('validates descriptor-safe inference and probability objects, symbols, classes, and accessors without invoking getters', () => {
    const accessorInference = Object.create(null);
    Object.defineProperty(accessorInference, 'contractVersion', {
      get: () => MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION,
    });
    expect(validateMLBOfflinePregameInference(accessorInference).ok).toBe(false);

    const classInstance = new (class Inference {} as unknown as { new (): Record<string, unknown> })();
    (classInstance as Record<string, unknown>).contractVersion = MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION;
    expect(validateMLBOfflinePregameInference(classInstance).ok).toBe(false);

    const symbolKey = Symbol('test');
    const symbolInference = {
      ...buildMinimalValidInference(),
      [symbolKey]: 'value',
    } as unknown as Record<symbol, string>;
    expect(validateMLBOfflinePregameInference(symbolInference as unknown as Record<string, unknown>).ok).toBe(false);

    let homeWinProbabilityGetterCalls = 0;
    let awayWinProbabilityGetterCalls = 0;
    let rootAccessorCalls = 0;

    const accessorProbs = {
      ...buildMinimalValidInference(),
      probabilities: Object.create(null),
    } as unknown as Record<string, unknown>;
    Object.defineProperty(accessorProbs, 'contractVersion', {
      get: () => { rootAccessorCalls++; return 'x'; },
    });
    Object.defineProperty(accessorProbs.probabilities, 'homeWinProbability', {
      get: () => { homeWinProbabilityGetterCalls++; return 0.5; },
    });
    Object.defineProperty(accessorProbs.probabilities, 'awayWinProbability', {
      get: () => { awayWinProbabilityGetterCalls++; return 0.5; },
    });
    expect(validateMLBOfflinePregameInference(accessorProbs).ok).toBe(false);
    expect(homeWinProbabilityGetterCalls).toBe(0);
    expect(awayWinProbabilityGetterCalls).toBe(0);
    expect(rootAccessorCalls).toBe(0);
  });

  it('builds a valid offline inference from a valid Phase 8I result, Phase 8E manifest, and Phase 8C snapshot', () => {
    const released = buildValidReleaseResult();
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot();
    expectValidLockedInputs(released, manifest, snapshot);
    expectValidLockedInputs(released, manifest, snapshot);
    const result = inferMLBOfflinePregameWinner(released, manifest, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.releaseId).toBe('model-1::offline-release-candidate-v1');
      expect(result.value.modelId).toBe('model-1');
      expect(result.value.planId).toBe('plan-1');
      expect(result.value.matrixId).toBe('matrix-1');
      expect(result.value.configId).toBe('config-1');
      expect(result.value.manifestId).toBe('manifest-1');
      expect(result.value.snapshotId).toBe('snapshot-1');
      expect(result.value.gameId).toBe('game-1');
      expect(result.value.officialDate).toBe('2026-07-15');
      expect(result.value.dataCutoffAt).toBe(FROZEN_DATA_CUTOFF);
      expect(result.value.homeTeamId).toBe('home-1');
      expect(result.value.awayTeamId).toBe('away-1');
      expect(result.value.predictedSide).toBe('HOME');
      expect(result.value.predictedTeamId).toBe('home-1');
    }
  });

  it('produces exactly 0.5/0.5 and predicts HOME for a zero score', () => {
    const released = buildValidReleaseResult({
      model: {
        intercept: 0,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
          { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
        ],
      },
    });
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot();
    expectValidLockedInputs(released, manifest, snapshot);
    expectValidLockedInputs(released, manifest, snapshot);
    const result = inferMLBOfflinePregameWinner(released, manifest, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.probabilities.homeWinProbability).toBe(0.5);
      expect(result.value.probabilities.awayWinProbability).toBe(0.5);
      expect(result.value.predictedSide).toBe('HOME');
      expect(result.value.predictedTeamId).toBe('home-1');
    }
  });

  it('produces the known sigmoid probability and HOME prediction for score +1', () => {
    const released = buildValidReleaseResult({
      model: {
        intercept: 0,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: 1, missingIndicatorCoefficient: 0 },
          { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
        ],
      },
    });
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot({
      sections: [
        {
          sectionId: 'sec-1',
          kind: 'GAME_CONTEXT',
          entity: { scope: 'GAME', entityId: null },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: { home: { p_1: 1 }, away: { p_2: 1 } },
        },
      ],
    });
    expectValidLockedInputs(released, manifest, snapshot);
    expectValidLockedInputs(released, manifest, snapshot);
    const result = inferMLBOfflinePregameWinner(released, manifest, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const expectedHome = 1 / (1 + Math.exp(-1));
      expect(result.value.probabilities.homeWinProbability).toBeCloseTo(expectedHome, 15);
      expect(result.value.probabilities.awayWinProbability).toBeCloseTo(1 - expectedHome, 15);
      expect(result.value.predictedSide).toBe('HOME');
      expect(result.value.predictedTeamId).toBe('home-1');
    }
  });

  it('produces the known sigmoid probability and AWAY prediction for score -1', () => {
    const released = buildValidReleaseResult({
      model: {
        intercept: 0,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: -1, missingIndicatorCoefficient: 0 },
          { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
        ],
      },
    });
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot({
      sections: [
        {
          sectionId: 'sec-1',
          kind: 'GAME_CONTEXT',
          entity: { scope: 'GAME', entityId: null },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: { home: { p_1: 1 }, away: { p_2: 1 } },
        },
      ],
    });
    expectValidLockedInputs(released, manifest, snapshot);
    expectValidLockedInputs(released, manifest, snapshot);
    const result = inferMLBOfflinePregameWinner(released, manifest, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const expectedHome = Math.exp(-1) / (1 + Math.exp(-1));
      expect(result.value.probabilities.homeWinProbability).toBeCloseTo(expectedHome, 15);
      expect(result.value.probabilities.awayWinProbability).toBeCloseTo(1 - expectedHome, 15);
      expect(result.value.predictedSide).toBe('AWAY');
      expect(result.value.predictedTeamId).toBe('away-1');
    }
  });

  it('proves raw feature values and missing indicators use separate frozen coefficients', () => {
    const released = buildValidReleaseResult({
      model: {
        intercept: 0,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: 1, missingIndicatorCoefficient: -1 },
          { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
        ],
      },
    });

    const manifest = buildValidManifest({
      features: [
        {
          featureId: 'p_1',
          sectionId: 'sec-1',
          payloadPath: ['home', 'p_1'],
          valueKind: 'NUMBER',
          missingPolicy: 'USE_DEFAULT',
          defaultValue: 0,
        },
        {
          featureId: 'p_2',
          sectionId: 'sec-1',
          payloadPath: ['away', 'p_2'],
          valueKind: 'NUMBER',
          missingPolicy: 'REJECT',
          defaultValue: null,
        },
      ],
    });

    const snapshotPresent = buildValidSnapshot({
      sections: [
        {
          sectionId: 'sec-1',
          kind: 'GAME_CONTEXT',
          entity: { scope: 'GAME', entityId: null },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: { home: { p_1: 1 }, away: { p_2: 0 } },
        },
      ],
    });
    expectValidLockedInputs(released, manifest, snapshotPresent);
    const resultPresent = inferMLBOfflinePregameWinner(released, manifest, snapshotPresent);
    expect(resultPresent.ok).toBe(true);
    if (resultPresent.ok) {
      expect(resultPresent.value.probabilities.homeWinProbability).toBeCloseTo(1 / (1 + Math.exp(-1)), 15);
      expect(resultPresent.value.predictedSide).toBe('HOME');
    }

    const snapshotMissing = buildValidSnapshot({
      sections: [
        {
          sectionId: 'sec-1',
          kind: 'GAME_CONTEXT',
          entity: { scope: 'GAME', entityId: null },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: { away: { p_2: 0 } },
        },
      ],
    });
    expectValidLockedInputs(released, manifest, snapshotMissing);
    const resultMissing = inferMLBOfflinePregameWinner(released, manifest, snapshotMissing);
    expect(resultMissing.ok).toBe(true);
    if (resultMissing.ok) {
      expect(resultMissing.value.probabilities.homeWinProbability).toBeCloseTo(Math.exp(-1) / (1 + Math.exp(-1)), 15);
      expect(resultMissing.value.predictedSide).toBe('AWAY');
    }
  });

  it('validates nested release status and maps team identity to the locked snapshot boundary while rejecting valid source-identity and feature-schema mismatches', () => {
    const baseReleased = buildValidReleaseResult();
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot();

    const badReleaseStatus = buildValidReleaseResult({
      release: { releaseStatus: 'DEPLOYED' },
    });
    expect(validateMLBModelTestReleaseResult(badReleaseStatus).ok).toBe(true);
    expect(validateMLBModelFitValidationResult(badReleaseStatus.fitValidation).ok).toBe(true);
    expect(validateMLBModelTestEvaluation(badReleaseStatus.test).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(badReleaseStatus.release).ok).toBe(false);
    const releaseStatusResult = inferMLBOfflinePregameWinner(badReleaseStatus, manifest, snapshot);
    expect(releaseStatusResult.ok).toBe(false);
    if (!releaseStatusResult.ok) {
      const codes = releaseStatusResult.issues.map((issue) => issue.code);
      expect(codes).toEqual(['RELEASE_STATUS_MISMATCH']);
      const paths = releaseStatusResult.issues.map((issue) => issue.path);
      expect(paths).toEqual(['$.releasedModelResult.release.releaseStatus']);
    }

    const badReleaseStatusAndId = buildValidReleaseResult({
      release: { releaseStatus: 'DEPLOYED', unknownField: 'x' },
    });
    expect(validateMLBModelTestReleaseResult(badReleaseStatusAndId).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(badReleaseStatusAndId.release).ok).toBe(false);
    const releaseStatusAndIdResult = inferMLBOfflinePregameWinner(badReleaseStatusAndId, manifest, snapshot);
    expect(releaseStatusAndIdResult.ok).toBe(false);
    if (!releaseStatusAndIdResult.ok) {
      const codes = releaseStatusAndIdResult.issues.map((issue) => issue.code);
      expect(codes).toEqual(['RELEASE_RESULT_INVALID']);
      const paths = releaseStatusAndIdResult.issues.map((issue) => issue.path);
      expect(paths).toEqual(['$.releasedModelResult.release']);
    }

    const badSnapshotTeams = buildValidSnapshot({
      game: { homeTeamId: 'home-1', awayTeamId: 'home-1' },
    });
    expect(validateMLBCanonicalPregameSnapshot(badSnapshotTeams).ok).toBe(false);
    const teamResult = inferMLBOfflinePregameWinner(baseReleased, manifest, badSnapshotTeams);
    expect(teamResult.ok).toBe(false);
    if (!teamResult.ok) {
      const codes = teamResult.issues.map((issue) => issue.code);
      expect(codes).toEqual(['SNAPSHOT_INVALID']);
    }

    const badManifestId = buildValidManifest({ manifestId: 'manifest-2' });
    expect(validateMLBModelTestReleaseResult(baseReleased).ok).toBe(true);
    expect(validateMLBModelFitValidationResult(baseReleased.fitValidation).ok).toBe(true);
    expect(validateMLBModelTestEvaluation(baseReleased.test).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(baseReleased.release).ok).toBe(true);
    expect(validateMLBFeatureManifest(badManifestId).ok).toBe(true);
    expect(validateMLBCanonicalPregameSnapshot(snapshot).ok).toBe(true);
    const manifestResult = inferMLBOfflinePregameWinner(baseReleased, badManifestId, snapshot);
    expect(manifestResult.ok).toBe(false);
    if (!manifestResult.ok) {
      const codes = manifestResult.issues.map((issue) => issue.code);
      expect(codes).toEqual(['SOURCE_IDENTITY_MISMATCH']);
    }

    const badFeatureSchema = buildValidManifest({
      manifestId: 'manifest-1',
      features: [
        { featureId: 'p_1', sectionId: 'sec-1', payloadPath: ['home'], valueKind: 'NUMBER', missingPolicy: 'REJECT', defaultValue: null },
        { featureId: 'p_3', sectionId: 'sec-1', payloadPath: ['away'], valueKind: 'NUMBER', missingPolicy: 'REJECT', defaultValue: null },
      ],
    });
    const badSchemaSnapshot = buildValidSnapshot({
      sections: [
        {
          sectionId: 'sec-1',
          kind: 'GAME_CONTEXT',
          entity: { scope: 'GAME', entityId: null },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: { home: { p_1: 1 }, away: { p_3: 1 } },
        },
      ],
    });
    expect(validateMLBModelTestReleaseResult(baseReleased).ok).toBe(true);
    expect(validateMLBModelFitValidationResult(baseReleased.fitValidation).ok).toBe(true);
    expect(validateMLBModelTestEvaluation(baseReleased.test).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(baseReleased.release).ok).toBe(true);
    expect(validateMLBFeatureManifest(badFeatureSchema).ok).toBe(true);
    expect(validateMLBCanonicalPregameSnapshot(badSchemaSnapshot).ok).toBe(true);
    const schemaResult = inferMLBOfflinePregameWinner(baseReleased, badFeatureSchema, badSchemaSnapshot);
    expect(schemaResult.ok).toBe(false);
    if (!schemaResult.ok) {
      const codes = schemaResult.issues.map((issue) => issue.code);
      expect(codes).toEqual(['FEATURE_SCHEMA_MISMATCH']);
    }

    const badResultId = {
      ...buildValidReleaseResult(),
      resultId: 'wrong-result-id',
    } as Record<string, unknown>;
    expect(validateMLBModelTestReleaseResult(badResultId).ok).toBe(true);
    expect(validateMLBModelFitValidationResult(badResultId.fitValidation).ok).toBe(true);
    expect(validateMLBModelTestEvaluation(badResultId.test).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(badResultId.release).ok).toBe(true);
    const resultIdResult = inferMLBOfflinePregameWinner(badResultId, manifest, snapshot);
    expect(resultIdResult.ok).toBe(false);
    if (!resultIdResult.ok) {
      const codes = resultIdResult.issues.map((issue) => issue.code);
      expect(codes).toEqual(['SOURCE_IDENTITY_MISMATCH']);
      const paths = resultIdResult.issues.map((issue) => issue.path);
      expect(paths).toEqual(['$.releasedModelResult.resultId']);
    }
  });

  it('maps invalid release result, manifest, and snapshot boundaries in exact validation order without pre-validation access', () => {
    const invalidRelease = { contractVersion: 'bad' };
    const invalidManifest = { contractVersion: 'bad' };
    const invalidSnapshot = { contractVersion: 'bad' };

    function createUntouchableRoot(
      label: string,
      counter: { value: number },
    ): Record<string, unknown> {
      const fail = (operation: string): never => {
        counter.value += 1;
        throw new Error(`${label} was touched through ${operation}`);
      };

      return new Proxy(
        Object.create(null) as Record<string, unknown>,
        {
          get() {
            return fail('get');
          },
          has() {
            return fail('has');
          },
          getPrototypeOf() {
            return fail('getPrototypeOf');
          },
          ownKeys() {
            return fail('ownKeys');
          },
          getOwnPropertyDescriptor() {
            return fail('getOwnPropertyDescriptor');
          },
        },
      );
    }

    const baseReleased = buildValidReleaseResult();
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot();

    const manifestCounter = { value: 0 };
    const snapshotCounter = { value: 0 };

    const manifestProxy = createUntouchableRoot('manifest', manifestCounter);
    const snapshotProxy = createUntouchableRoot('snapshot', snapshotCounter);

    const releaseOnly = inferMLBOfflinePregameWinner(invalidRelease, manifestProxy, snapshotProxy);
    expect(releaseOnly.ok).toBe(false);
    if (!releaseOnly.ok) {
      expect(releaseOnly.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'RELEASE_RESULT_INVALID', path: '$.releasedModelResult' }),
        ]),
      );
      expect(releaseOnly.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'RELEASE_RESULT_INVALID' }),
        ]),
      );
    }
    expect(manifestCounter.value).toBe(0);
    expect(snapshotCounter.value).toBe(0);

    const shallowRelease = buildValidReleaseResult({
      release: { releaseStatus: 'DEPLOYED' },
    });
    expect(validateMLBModelTestReleaseResult(shallowRelease).ok).toBe(true);
    expect(validateMLBModelFitValidationResult(shallowRelease.fitValidation).ok).toBe(true);
    expect(validateMLBModelTestEvaluation(shallowRelease.test).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(shallowRelease.release).ok).toBe(false);

    const manifestCounterB = { value: 0 };
    const snapshotCounterB = { value: 0 };
    const manifestProxyB = createUntouchableRoot('manifest', manifestCounterB);
    const snapshotProxyB = createUntouchableRoot('snapshot', snapshotCounterB);
    const releaseStatusOnly = inferMLBOfflinePregameWinner(shallowRelease, manifestProxyB, snapshotProxyB);
    expect(releaseStatusOnly.ok).toBe(false);
    if (!releaseStatusOnly.ok) {
      expect(releaseStatusOnly.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'RELEASE_STATUS_MISMATCH', path: '$.releasedModelResult.release.releaseStatus' }),
        ]),
      );
      expect(releaseStatusOnly.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'RELEASE_STATUS_MISMATCH' }),
        ]),
      );
    }
    expect(manifestCounterB.value).toBe(0);
    expect(snapshotCounterB.value).toBe(0);

    const manifestOnly = inferMLBOfflinePregameWinner(baseReleased, invalidManifest, snapshotProxy);
    expect(manifestOnly.ok).toBe(false);
    if (!manifestOnly.ok) {
      expect(manifestOnly.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'MANIFEST_INVALID', path: '$.featureManifest' }),
        ]),
      );
      expect(manifestOnly.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'MANIFEST_INVALID' }),
        ]),
      );
    }
    expect(snapshotCounter.value).toBe(0);

    const snapshotOnly = inferMLBOfflinePregameWinner(baseReleased, manifest, invalidSnapshot);
    expect(snapshotOnly.ok).toBe(false);
    if (!snapshotOnly.ok) {
      expect(snapshotOnly.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'SNAPSHOT_INVALID', path: '$.snapshot' }),
        ]),
      );
      expect(snapshotOnly.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'SNAPSHOT_INVALID' }),
        ]),
      );
    }
  });

  it('maps feature-extraction failure without partial output and proves successful Phase 8E extraction is validator-valid', () => {
    const released = buildValidReleaseResult();
    const manifest = buildValidManifest();
    const badSnapshot = buildValidSnapshot({
      sections: [
        {
          sectionId: 'sec-1',
          kind: 'GAME_CONTEXT',
          entity: { scope: 'GAME', entityId: null },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: { home: { p_1: 'not-a-number' }, away: { p_2: 1 } },
        },
      ],
    });

    expect(validateMLBModelTestReleaseResult(released).ok).toBe(true);
    expect(validateMLBModelFitValidationResult(released.fitValidation).ok).toBe(true);
    expect(validateMLBModelTestEvaluation(released.test).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(released.release).ok).toBe(true);
    expect(validateMLBFeatureManifest(manifest).ok).toBe(true);
    expect(validateMLBCanonicalPregameSnapshot(badSnapshot).ok).toBe(true);

    const extractionResult = inferMLBOfflinePregameWinner(released, manifest, badSnapshot);
    expect(extractionResult.ok).toBe(false);
    if (!extractionResult.ok) {
      const codes = extractionResult.issues.map((issue: { code: string }) => issue.code);
      expect(codes).toEqual(['FEATURE_EXTRACTION_FAILED']);
    }

    const validSnapshot = buildValidSnapshot();
    const validExtraction = extractMLBLeakageSafeFeatureVector(manifest, validSnapshot);
    expect(validExtraction.ok).toBe(true);
    if (validExtraction.ok) {
      const vectorResult = validateMLBFeatureVector(validExtraction.value);
      expect(vectorResult.ok).toBe(true);
      const inferenceResult = inferMLBOfflinePregameWinner(released, manifest, validSnapshot);
      expect(inferenceResult.ok).toBe(true);
    }
  });

  it('rejects finite-overflow numerical execution with NUMERICAL_FAILURE after all locked input validators succeed', () => {
    const finiteCoefficient = 2;
    const finiteFeatureValue = Number.MAX_VALUE;
    const overflowingProduct = finiteCoefficient * finiteFeatureValue;

    const released = buildValidReleaseResult({
      model: {
        intercept: 0,
        coefficients: [
          { featureId: 'p_1', valueCoefficient: finiteCoefficient, missingIndicatorCoefficient: 0 },
          { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
        ],
      },
    });
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot({
      sections: [
        {
          sectionId: 'sec-1',
          kind: 'GAME_CONTEXT',
          entity: { scope: 'GAME', entityId: null },
          status: 'AVAILABLE',
          asOfAt: FROZEN_DATA_CUTOFF,
          sourceRefIds: ['src-official'],
          payload: { home: { p_1: finiteFeatureValue }, away: { p_2: 1 } },
        },
      ],
    });

    expect(Number.isFinite(finiteCoefficient)).toBe(true);
    expect(Number.isFinite(finiteFeatureValue)).toBe(true);
    expect(Number.isFinite(overflowingProduct)).toBe(false);

    const releaseValid = validateMLBModelTestReleaseResult(released);
    expect(validateMLBModelFitValidationResult(released.fitValidation).ok).toBe(true);
    expect(validateMLBModelTestEvaluation(released.test).ok).toBe(true);
    expect(validateMLBModelReleaseRecord(released.release).ok).toBe(true);
    const manifestValid = validateMLBFeatureManifest(manifest);
    const snapshotValid = validateMLBCanonicalPregameSnapshot(snapshot);
    expect(releaseValid.ok).toBe(true);
    expect(manifestValid.ok).toBe(true);
    expect(snapshotValid.ok).toBe(true);

    const result = inferMLBOfflinePregameWinner(released, manifest, snapshot);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'NUMERICAL_FAILURE', path: '$.inference' }),
        ]),
      );
    }
  });

  it('preserves release, model, manifest, snapshot, game, team, date, and cutoff lineage exactly', () => {
    const released = buildValidReleaseResult();
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot();
    expectValidLockedInputs(released, manifest, snapshot);
    expectValidLockedInputs(released, manifest, snapshot);
    const result = inferMLBOfflinePregameWinner(released, manifest, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.releaseId).toBe('model-1::offline-release-candidate-v1');
      expect(result.value.modelId).toBe('model-1');
      expect(result.value.planId).toBe('plan-1');
      expect(result.value.matrixId).toBe('matrix-1');
      expect(result.value.configId).toBe('config-1');
      expect(result.value.manifestId).toBe('manifest-1');
      expect(result.value.snapshotId).toBe('snapshot-1');
      expect(result.value.gameId).toBe('game-1');
      expect(result.value.officialDate).toBe('2026-07-15');
      expect(result.value.dataCutoffAt).toBe(FROZEN_DATA_CUTOFF);
    }
  });

  it('proves Phase 8H VALIDATION metrics and Phase 8I TEST metrics are not read after Phase 8I validation', () => {
    const validationReads = { logLoss: 0, brierScore: 0, rocAuc: 0 };
    const testReads = { logLoss: 0, brierScore: 0, rocAuc: 0 };

    function createTrackedProxy(target: Record<string, unknown>, reads: Record<string, number>, prefix: string) {
      return new Proxy(target, {
        get(obj, prop) {
          if (prop === 'logLoss' || prop === 'brierScore' || prop === 'rocAuc') {
            reads[prop as string]++;
          }
          return Reflect.get(obj, prop);
        },
      });
    }

    const released = buildValidReleaseResult({
      model: {
        modelId: 'model-1',
        planId: 'plan-1',
        matrixId: 'matrix-1',
        configId: 'config-1',
        manifestId: 'manifest-1',
        sport: 'MLB',
        target: 'OFFICIAL_FINAL_GAME_WINNER',
        targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
        algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
        intercept: 0,
        featureIds: ['p_1', 'p_2'],
        coefficients: [
          { featureId: 'p_1', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
          { featureId: 'p_2', valueCoefficient: 0, missingIndicatorCoefficient: 0 },
        ],
      },
      validation: {
        contractVersion: 'mlb-model-validation-evaluation-v1',
        sport: 'MLB',
        target: 'OFFICIAL_FINAL_GAME_WINNER',
        targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
        evaluationId: 'model-1::validation-v1',
        modelId: 'model-1',
        planId: 'plan-1',
        matrixId: 'matrix-1',
        configId: 'config-1',
        split: 'VALIDATION',
        rowCount: 2,
        metrics: createTrackedProxy(
          { logLoss: 0.5, brierScore: 0.5, rocAuc: 0.5 },
          validationReads,
          'validation',
        ),
      },
      test: {
        contractVersion: 'mlb-model-test-evaluation-v1',
        sport: 'MLB',
        target: 'OFFICIAL_FINAL_GAME_WINNER',
        targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
        evaluationId: 'model-1::test-v1',
        modelId: 'model-1',
        planId: 'plan-1',
        matrixId: 'matrix-1',
        configId: 'config-1',
        split: 'TEST',
        rowCount: 2,
        metrics: createTrackedProxy(
          { logLoss: 0.5, brierScore: 0.5, rocAuc: 0.5 },
          testReads,
          'test',
        ),
      },
    });

    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot();

    const validationResult = validateMLBModelTestReleaseResult(released);
    expect(validationResult.ok).toBe(true);
    if (validationResult.ok) {
      expect(validateMLBModelFitValidationResult(validationResult.value.fitValidation).ok).toBe(true);
      expect(validateMLBModelTestEvaluation(validationResult.value.test).ok).toBe(true);
      expect(validateMLBModelReleaseRecord(validationResult.value.release).ok).toBe(true);
    }

    validationReads.logLoss = 0;
    validationReads.brierScore = 0;
    validationReads.rocAuc = 0;
    testReads.logLoss = 0;
    testReads.brierScore = 0;
    testReads.rocAuc = 0;

    const result = inferMLBOfflinePregameWinner(released, manifest, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.probabilities.homeWinProbability).toBeCloseTo(0.5, 15);
      expect(result.value.predictedSide).toBe('HOME');
    }

    expect(validationReads.logLoss).toBe(0);
    expect(validationReads.brierScore).toBe(0);
    expect(validationReads.rocAuc).toBe(0);
    expect(testReads.logLoss).toBe(0);
    expect(testReads.brierScore).toBe(0);
    expect(testReads.rocAuc).toBe(0);
  });

  it('produces deeply deterministic output without mutating the release result, manifest, snapshot, extracted vector, or frozen model', () => {
    const released = buildValidReleaseResult();
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot();
    expectValidLockedInputs(released, manifest, snapshot);

    const releasedCopy = JSON.parse(JSON.stringify(released));
    const manifestCopy = JSON.parse(JSON.stringify(manifest));
    const snapshotCopy = JSON.parse(JSON.stringify(snapshot));

    const result1 = inferMLBOfflinePregameWinner(released, manifest, snapshot);
    const result2 = inferMLBOfflinePregameWinner(released, manifest, snapshot);

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    if (result1.ok && result2.ok) {
      expect(result1.value).toEqual(result2.value);
    }

    expect(released).toEqual(releasedCopy);
    expect(manifest).toEqual(manifestCopy);
    expect(snapshot).toEqual(snapshotCopy);
  });

  it('rejects odds contamination, market concepts, raw scores, vectors, recommendations, multis, stakes, grading, and prohibited fields', () => {
    const base = buildMinimalValidInference();
    expect(validateMLBOfflinePregameInference(base)).toEqual(expect.objectContaining({ ok: true }));

    const contaminated = { ...base, odds: { home: 150, away: -170 } };
    expect(validateMLBOfflinePregameInference(contaminated).ok).toBe(false);

    const withVector = { ...base, featureVector: { values: [] } };
    expect(validateMLBOfflinePregameInference(withVector).ok).toBe(false);

    const withScore = { ...base, score: 1.5 };
    expect(validateMLBOfflinePregameInference(withScore).ok).toBe(false);

    const withRecommendation = { ...base, recommendation: { side: 'HOME' } };
    expect(validateMLBOfflinePregameInference(withRecommendation).ok).toBe(false);

    const withStake = { ...base, stake: 100 };
    expect(validateMLBOfflinePregameInference(withStake).ok).toBe(false);
  });

  it('proves the successful output contains no feature values, missing flags, coefficients, raw score, evaluation metrics, labels, or row-level data', () => {
    const released = buildValidReleaseResult();
    const manifest = buildValidManifest();
    const snapshot = buildValidSnapshot();
    expectValidLockedInputs(released, manifest, snapshot);
    const result = inferMLBOfflinePregameWinner(released, manifest, snapshot);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const inference = result.value as Record<string, unknown>;
      expect(inference.featureVector).toBeUndefined();
      expect(inference.features).toBeUndefined();
      expect(inference.values).toBeUndefined();
      expect(inference.wasMissing).toBeUndefined();
      expect(inference.coefficients).toBeUndefined();
      expect(inference.intercept).toBeUndefined();
      expect(inference.score).toBeUndefined();
      expect(inference.linearScore).toBeUndefined();
      expect(inference.validationMetrics).toBeUndefined();
      expect(inference.testMetrics).toBeUndefined();
      expect(inference.label).toBeUndefined();
      expect(inference.targetValue).toBeUndefined();
      expect(inference.trainingRows).toBeUndefined();
      expect(inference.finalizedAt).toBeUndefined();
    }
  });

  it('verifies issue ordering, exact exports/imports, no fitting, no live integration, and the static architecture boundary', async () => {
    const source = await readFile(
      new URL('../../../src/prediction/mlb/mlb-offline-pregame-inference-contract.ts', import.meta.url),
      'utf-8',
    );

    const expectedExports = [
      'MLB_OFFLINE_PREGAME_INFERENCE_CONTRACT_VERSION',
      'MLB_OFFLINE_PREGAME_DECISION_POLICY',
      'MLBOfflinePregamePredictedSide',
      'MLBOfflinePregameProbabilityPair',
      'MLBOfflinePregameInference',
      'MLBOfflinePregameInferenceIssue',
      'validateMLBOfflinePregameInference',
      'inferMLBOfflinePregameWinner',
    ];

    const exports = source.match(/\bexport\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g) || [];
    const exportNames = exports.map((e) => e.replace(/export\s+(?:const|type|function)\s+/, ''));

    expect(exportNames).toEqual(expectedExports);

    const expectedImports = [
      '../firewall/odds-contamination-guard',
      './mlb-pregame-snapshot-contract',
      './mlb-feature-vector-contract',
      './mlb-model-test-release-contract',
      './mlb-logistic-regression-fit-contract',
    ];

    const imports = source.match(/(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g) || [];
    const importPaths = imports.map((i) => i.match(/['"]([^'"]+)['"]/)?.[1] || '');

    expect(importPaths).toEqual(expectedImports);

    expect(source).toContain('validateMLBModelFitValidationResult(');
    expect(source).toContain('validateMLBModelTestEvaluation(');
    expect(source).toContain('validateMLBModelReleaseRecord(');
    expect(source).toContain('validateMLBOfflinePregameInference(');
    expect(source).toContain('assertNoOddsContamination(');
    expect(source).not.toMatch(/Math\.min\(score,\s*500\)/);
    expect(source).not.toMatch(/Math\.max\(score,\s*-500\)/);

    expect(source).not.toMatch(/\bexport\s+(?:enum|interface)\s+/);
    expect(source).not.toMatch(/from\s+['"]node:fs/);
    expect(source).not.toMatch(/fetch\(/);
    expect(source).not.toMatch(/Math\.random/);
    expect(source).not.toMatch(/Date\.now/);
    expect(source).not.toMatch(/randomUUID/);
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/localeCompare/);
    expect(source).not.toMatch(/\bupdateCoefficients\s*\(/);
    expect(source).not.toMatch(/\bfitModel\s*\(/);
    expect(source).not.toMatch(/\btrainModel\s*\(/);
    expect(source).not.toMatch(/\bcalibrate/);
    expect(source).not.toMatch(/\bgenerateRecommendation\s*\(/);
    expect(source).not.toMatch(/\bbuildMulti\s*\(/);
    expect(source).not.toMatch(/\bcalculateStake\s*\(/);
    expect(source).not.toMatch(/\bgradePrediction\s*\(/);
    expect(source).not.toMatch(/from\s+['"]@prisma/);
    expect(source).not.toMatch(/PrismaClient/);

    const testSource = await readFile(
      new URL('../../../tests/prediction/mlb/mlb-offline-pregame-inference-contract.test.ts', import.meta.url),
      'utf-8',
    );

    const testCount = (testSource.match(/\bit\s*\(/g) || []).length;
    expect(testCount).toBe(20);

    const issues: string[] = [];
    const forbiddenTestImports = [
      'mlb-prediction-contract.ts',
      'mlb-historical-labelled-dataset',
      'mlb-training-matrix',
      'mlb-model-training-plan',
      'mlb-logistic-regression-fit',
    ];
    for (const forbidden of forbiddenTestImports) {
      if (testSource.includes("from '" + forbidden + "'") || testSource.includes('from "' + forbidden + '"')) {
        issues.push('forbidden-test-import: ' + forbidden);
      }
    }
    if (testSource.includes('from') && /from\s+['"][^'"]+['"]/.test(testSource)) {
      const testImports = testSource.match(/from\s+['"]([^'"]+)['"]/g) || [];
      for (const imp of testImports) {
        const path = imp.match(/['"]([^'"]+)['"]/)?.[1] || '';
        if (!['vitest', '@/prediction/mlb/mlb-offline-pregame-inference-contract', 'node:fs/promises', '@/prediction/mlb/mlb-model-test-release-contract', '@/prediction/mlb/mlb-feature-vector-contract', '@/prediction/mlb/mlb-pregame-snapshot-contract', '@/prediction/firewall/odds-contamination-guard', '@/prediction/mlb/mlb-logistic-regression-fit-contract'].includes(path)) {
          issues.push(`unexpected-test-import: ${path}`);
        }
      }
    }
    expect(issues).toEqual([]);
  });
});
