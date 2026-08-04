import { describe, expect, it } from 'vitest';
import {
  MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION,
  MLB_OFFLINE_PREDICTION_SLATE_ORDER_POLICY,
  MLBOfflinePredictionSlateIssue,
  validateMLBOfflinePredictionSlate,
  buildMLBOfflinePredictionSlate,
} from '@/prediction/mlb/mlb-offline-prediction-slate-contract';
import { validateMLBOfflinePregameInference } from '@/prediction/mlb/mlb-offline-pregame-inference-contract';
import { readFile } from 'node:fs/promises';

const BASE_RELEASE_ID = 'release-1';
const BASE_MODEL_ID = 'model-1';
const BASE_PLAN_ID = 'plan-1';
const BASE_MATRIX_ID = 'matrix-1';
const BASE_CONFIG_ID = 'config-1';
const BASE_MANIFEST_ID = 'manifest-1';
const BASE_SNAPSHOT_ID = 'snapshot-1';
const BASE_GAME_ID = 'game-1';
const BASE_OFFICIAL_DATE = '2026-08-01';
const BASE_DATA_CUTOFF = '2026-07-30T09:00:00Z';

function buildValidInference(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const releaseId = overrides.releaseId ?? BASE_RELEASE_ID;
  const snapshotId = overrides.snapshotId ?? BASE_SNAPSHOT_ID;
  const inferenceId =
    overrides.inferenceId ??
    `${releaseId}::${snapshotId}::offline-pregame-inference-v1`;

  return {
    contractVersion: 'mlb-offline-pregame-inference-v1',
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    inferenceId,
    releaseId,
    modelId: overrides.modelId ?? BASE_MODEL_ID,
    planId: overrides.planId ?? BASE_PLAN_ID,
    matrixId: overrides.matrixId ?? BASE_MATRIX_ID,
    configId: overrides.configId ?? BASE_CONFIG_ID,
    manifestId: overrides.manifestId ?? BASE_MANIFEST_ID,
    snapshotId,
    gameId: overrides.gameId ?? BASE_GAME_ID,
    officialDate: overrides.officialDate ?? BASE_OFFICIAL_DATE,
    dataCutoffAt: overrides.dataCutoffAt ?? BASE_DATA_CUTOFF,
    algorithm: overrides.algorithm ?? 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    decisionPolicy: overrides.decisionPolicy ?? 'HOME_AT_OR_ABOVE_0_5_V1',
    homeTeamId: overrides.homeTeamId ?? 'home-1',
    awayTeamId: overrides.awayTeamId ?? 'away-1',
    probabilities: overrides.probabilities ?? {
      homeWinProbability: 0.75,
      awayWinProbability: 0.25,
    },
    predictedSide: overrides.predictedSide ?? 'HOME',
    predictedTeamId: overrides.predictedTeamId ?? 'home-1',
    ...overrides,
  };
}

function ensureValidInference(
  inference: Record<string, unknown>,
): Record<string, unknown> {
  const result = validateMLBOfflinePregameInference(inference);
  if (result.ok) {
    return result.value;
  }
  throw new Error('Inference validation failed');
}

function buildValidSlate(
  predictions: readonly unknown[],
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const first = predictions[0] as Record<string, unknown>;
  const releaseId = first.releaseId as string;
  const officialDate = first.officialDate as string;
  const slateId = `${releaseId}::${officialDate}::${MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION}`;

  return {
    contractVersion: MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    slateId,
    releaseId,
    modelId: first.modelId as string,
    planId: first.planId as string,
    matrixId: first.matrixId as string,
    configId: first.configId as string,
    manifestId: first.manifestId as string,
    officialDate,
    orderPolicy: MLB_OFFLINE_PREDICTION_SLATE_ORDER_POLICY,
    predictionCount: predictions.length,
    predictions: predictions.slice() as readonly unknown[],
    ...overrides,
  };
}

function allPermutations<T>(items: readonly T[]): readonly T[][] {
  if (items.length <= 1) {
    return [items.slice() as T[]];
  }
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const perm of allPermutations(rest)) {
      result.push([items[i]].concat(perm));
    }
  }
  return result as readonly T[][];
}

function createUntouchableInference(
  counter: { value: number },
): Record<string, unknown> {
  const fail = (operation: string): never => {
    counter.value += 1;
    throw new Error(`Inference was touched through ${operation}`);
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

describe('mlb-offline-prediction-slate-contract', () => {
  it('accepts a minimal valid prediction slate and returns the exact original reference', () => {
    const inference = ensureValidInference(buildValidInference());
    const proposed = buildValidSlate([inference]);
    const result = validateMLBOfflinePredictionSlate(proposed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(proposed);
    }
  });

  it('validates exact slate fields, literals, lineage, count, order policy, date, and deterministic slate ID', () => {
    const inference = ensureValidInference(buildValidInference());
    const proposed = buildValidSlate([inference]);
    const result = validateMLBOfflinePredictionSlate(proposed);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.contractVersion).toBe(MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION);
      expect(result.value.sport).toBe('MLB');
      expect(result.value.target).toBe('OFFICIAL_FINAL_GAME_WINNER');
      expect(result.value.targetEncoding).toBe('HOME_WIN_1_AWAY_WIN_0');
      expect(result.value.slateId).toBe(`${BASE_RELEASE_ID}::${BASE_OFFICIAL_DATE}::mlb-offline-prediction-slate-v1`);
      expect(result.value.releaseId).toBe(BASE_RELEASE_ID);
      expect(result.value.modelId).toBe(BASE_MODEL_ID);
      expect(result.value.planId).toBe(BASE_PLAN_ID);
      expect(result.value.matrixId).toBe(BASE_MATRIX_ID);
      expect(result.value.configId).toBe(BASE_CONFIG_ID);
      expect(result.value.manifestId).toBe(BASE_MANIFEST_ID);
      expect(result.value.officialDate).toBe(BASE_OFFICIAL_DATE);
      expect(result.value.orderPolicy).toBe(MLB_OFFLINE_PREDICTION_SLATE_ORDER_POLICY);
      expect(result.value.predictionCount).toBe(1);
      expect(result.value.predictions).toHaveLength(1);
    }
  });

  it('validates every nested Phase 8J inference and maps an invalid prediction to its exact index path', () => {
    const validInference = ensureValidInference(buildValidInference());
    const invalidInference = buildValidInference({
      contractVersion: 'bad',
      inferenceId: 'release-1::snapshot-bad::offline-pregame-inference-v1',
      snapshotId: 'snapshot-bad',
      gameId: 'game-bad',
    });
    expect(validateMLBOfflinePregameInference(invalidInference).ok).toBe(false);

    const proposed = buildValidSlate([validInference, invalidInference]);
    const result = validateMLBOfflinePredictionSlate(proposed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { code: 'INFERENCE_INVALID', path: '$.predictions[1]', message: 'Invalid inference' },
      ]);
    }
  });

  it('stops at the first invalid inference without touching a later inference object', () => {
    const invalidInference = buildValidInference({
      contractVersion: 'bad',
      inferenceId: 'release-1::snapshot-bad::offline-pregame-inference-v1',
      snapshotId: 'snapshot-bad',
      gameId: 'game-bad',
    });
    expect(validateMLBOfflinePregameInference(invalidInference).ok).toBe(false);

    const laterCounter = { value: 0 };
    const laterInference = createUntouchableInference(laterCounter);

    const result = buildMLBOfflinePredictionSlate([
      invalidInference,
      laterInference,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        { code: 'INFERENCE_INVALID', path: '$.inferences[0]', message: 'Invalid inference' },
      ]);
    }
    expect(laterCounter.value).toBe(0);
  });

  it('validates descriptor-safe slate roots, prediction arrays, symbols, classes, and accessors without invoking getters', () => {
    const validInference = ensureValidInference(buildValidInference());
    const baseSlate = buildValidSlate([validInference]);

    const rootAccessorCalls = { value: 0 };
    const predictionsAccessorCalls = { value: 0 };
    const indexAccessorCalls = { value: 0 };

    const rootAccessorSlate: Record<string, unknown> = Object.create(null);
    for (const key of Object.getOwnPropertyNames(baseSlate)) {
      if (key === 'contractVersion') {
        Object.defineProperty(rootAccessorSlate, key, {
          enumerable: true,
          get: () => {
            rootAccessorCalls.value += 1;
            throw new Error('must not invoke');
          },
        });
      } else {
        Object.defineProperty(rootAccessorSlate, key, {
          enumerable: true,
          value: (baseSlate as Record<string, unknown>)[key],
        });
      }
    }

    const predictionsAccessorSlate: Record<string, unknown> = Object.create(null);
    for (const key of Object.getOwnPropertyNames(baseSlate)) {
      if (key === 'predictions') {
        Object.defineProperty(predictionsAccessorSlate, key, {
          enumerable: true,
          get: () => {
            predictionsAccessorCalls.value += 1;
            throw new Error('must not invoke');
          },
        });
      } else {
        Object.defineProperty(predictionsAccessorSlate, key, {
          enumerable: true,
          value: (baseSlate as Record<string, unknown>)[key],
        });
      }
    }

    const indexAccessorArray = (baseSlate.predictions as unknown[]).slice();
    Object.defineProperty(indexAccessorArray, '0', {
      enumerable: true,
      get: () => {
        indexAccessorCalls.value += 1;
        throw new Error('must not invoke');
      },
    });
    const indexAccessorSlate = buildValidSlate([validInference], {
      predictions: indexAccessorArray,
    });

    expect(validateMLBOfflinePredictionSlate(rootAccessorSlate).ok).toBe(false);
    expect(rootAccessorCalls.value).toBe(0);

    expect(validateMLBOfflinePredictionSlate(predictionsAccessorSlate).ok).toBe(false);
    expect(predictionsAccessorCalls.value).toBe(0);

    expect(validateMLBOfflinePredictionSlate(indexAccessorSlate).ok).toBe(false);
    expect(indexAccessorCalls.value).toBe(0);
  });

  it('rejects non-array, empty, sparse, accessor-bearing, symbol-bearing, and extra-property builder inputs deterministically', () => {
    const validInference = ensureValidInference(buildValidInference());

    expect(buildMLBOfflinePredictionSlate('not-array').ok).toBe(false);
    expect(
      buildMLBOfflinePredictionSlate([] as unknown[]).ok,
    ).toBe(false);

    const sparseArray: unknown[] = [];
    sparseArray.length = 2;
    sparseArray[1] = validInference;
    expect(buildMLBOfflinePredictionSlate(sparseArray).ok).toBe(false);

    const accessorArray: unknown[] = [];
    Object.defineProperty(accessorArray, '0', {
      enumerable: true,
      get: () => {
        throw new Error('must not invoke');
      },
    });
    expect(buildMLBOfflinePredictionSlate(accessorArray).ok).toBe(false);

    const symbolArray: unknown[] = [];
    const symbol = Symbol('test');
    Object.defineProperty(symbolArray, symbol, {
      enumerable: true,
      value: validInference,
    });
    expect(buildMLBOfflinePredictionSlate(symbolArray).ok).toBe(false);

    const extraPropArray = [validInference] as unknown[];
    Object.defineProperty(extraPropArray, 'extra', {
      enumerable: true,
      value: 1,
    });
    expect(buildMLBOfflinePredictionSlate(extraPropArray).ok).toBe(false);
  });

  it('builds a valid one-game slate from one validated Phase 8J inference', () => {
    const inference = ensureValidInference(buildValidInference());
    const result = buildMLBOfflinePredictionSlate([inference]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.predictions).toHaveLength(1);
      expect(result.value.predictions[0]).toBe(inference);
      expect(result.value.slateId).toBe(`${BASE_RELEASE_ID}::${BASE_OFFICIAL_DATE}::mlb-offline-prediction-slate-v1`);
      expect(result.value.predictionCount).toBe(1);
    }
  });

  it('builds a canonically ordered multi-game slate from permuted valid inference inputs', () => {
    const inferenceA = ensureValidInference(
      buildValidInference({
        gameId: 'game-c',
        snapshotId: 'snapshot-c',
        inferenceId: 'release-1::snapshot-c::offline-pregame-inference-v1',
        homeTeamId: 'home-c',
        awayTeamId: 'away-c',
        predictedTeamId: 'home-c',
      }),
    );
    const inferenceB = ensureValidInference(
      buildValidInference({
        gameId: 'game-a',
        snapshotId: 'snapshot-a',
        inferenceId: 'release-1::snapshot-a::offline-pregame-inference-v1',
        homeTeamId: 'home-a',
        awayTeamId: 'away-a',
        predictedTeamId: 'home-a',
      }),
    );
    const inferenceC = ensureValidInference(
      buildValidInference({
        gameId: 'game-b',
        snapshotId: 'snapshot-b',
        inferenceId: 'release-1::snapshot-b::offline-pregame-inference-v1',
        homeTeamId: 'home-b',
        awayTeamId: 'away-b',
        predictedTeamId: 'home-b',
      }),
    );

    const result = buildMLBOfflinePredictionSlate([inferenceC, inferenceA, inferenceB]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.predictions).toHaveLength(3);
      expect(result.value.predictions[0]).toBe(inferenceB);
      expect(result.value.predictions[1]).toBe(inferenceC);
      expect(result.value.predictions[2]).toBe(inferenceA);
    }
  });

  it('produces deeply deterministic output across input permutations without mutating any input', () => {
    const inferenceA = ensureValidInference(
      buildValidInference({
        gameId: 'game-a',
        snapshotId: 'snapshot-a',
        inferenceId: 'release-1::snapshot-a::offline-pregame-inference-v1',
        homeTeamId: 'home-a',
        awayTeamId: 'away-a',
        predictedTeamId: 'home-a',
      }),
    );
    const inferenceB = ensureValidInference(
      buildValidInference({
        gameId: 'game-b',
        snapshotId: 'snapshot-b',
        inferenceId: 'release-1::snapshot-b::offline-pregame-inference-v1',
        homeTeamId: 'home-b',
        awayTeamId: 'away-b',
        predictedTeamId: 'away-b',
        probabilities: { homeWinProbability: 0.25, awayWinProbability: 0.75 },
        predictedSide: 'AWAY',
      }),
    );
    const inferenceC = ensureValidInference(
      buildValidInference({
        gameId: 'game-c',
        snapshotId: 'snapshot-c',
        inferenceId: 'release-1::snapshot-c::offline-pregame-inference-v1',
        homeTeamId: 'home-c',
        awayTeamId: 'away-c',
        predictedTeamId: 'home-c',
      }),
    );

    const permutations = allPermutations([inferenceA, inferenceB, inferenceC]);
    const originalOrders =
      permutations.map(
        (permutation) => [
          ...permutation,
        ],
      );

    type CapturedInferenceState = {
      readonly rootNames:
        readonly string[];

      readonly rootSymbols:
        readonly symbol[];

      readonly scalarEntries:
        ReadonlyArray<
          readonly [
            string,
            unknown,
          ]
        >;

      readonly probabilitiesReference:
        Record<string, unknown>;

      readonly homeWinProbability:
        unknown;

      readonly awayWinProbability:
        unknown;

      readonly probabilityNames:
        readonly string[];

      readonly probabilitySymbols:
        readonly symbol[];
    };

    function captureInferenceState(
      inference: Record<string, unknown>,
    ): CapturedInferenceState {
      const rootNames = Object.getOwnPropertyNames(inference);
      const rootSymbols = Object.getOwnPropertySymbols(inference);
      const scalarEntries: Array<readonly [string, unknown]> = [];

      for (const key of rootNames) {
        const descriptor = Object.getOwnPropertyDescriptor(inference, key);
        if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          if (key !== 'probabilities') {
            scalarEntries.push([key, descriptor.value] as const);
          }
        }
      }

      const probabilitiesDescriptor = Object.getOwnPropertyDescriptor(
        inference,
        'probabilities',
      );
      const probabilitiesReference =
        probabilitiesDescriptor &&
        Object.prototype.hasOwnProperty.call(probabilitiesDescriptor, 'value')
          ? (probabilitiesDescriptor.value as Record<string, unknown>)
          : ({} as Record<string, unknown>);

      const homeWinProbability =
        probabilitiesReference.homeWinProbability;

      const awayWinProbability =
        probabilitiesReference.awayWinProbability;

      const probabilityNames = Object.getOwnPropertyNames(
        probabilitiesReference,
      );

      const probabilitySymbols = Object.getOwnPropertySymbols(
        probabilitiesReference,
      );

      return {
        rootNames,
        rootSymbols,
        scalarEntries,
        probabilitiesReference,
        homeWinProbability,
        awayWinProbability,
        probabilityNames,
        probabilitySymbols,
      };
    }

    const capturedStates = [inferenceA, inferenceB, inferenceC].map(
      captureInferenceState,
    );

    const successfulValues: Array<
      Extract<
        ReturnType<
          typeof buildMLBOfflinePredictionSlate
        >,
        {
          ok: true;
        }
      >['value']
    > = [];

    for (const permutation of permutations) {
      const result =
        buildMLBOfflinePredictionSlate(
          permutation,
        );

      expect(result.ok).toBe(true);

      if (!result.ok) {
        throw new Error(
          'Expected successful slate build',
        );
      }

      successfulValues.push(
        result.value,
      );
    }

    for (
      let permutationIndex = 0;
      permutationIndex
      < permutations.length;
      permutationIndex += 1
    ) {
      for (
        let entryIndex = 0;
        entryIndex
        < permutations[
          permutationIndex
        ].length;
        entryIndex += 1
      ) {
        expect(
          permutations[
            permutationIndex
          ][entryIndex],
        ).toBe(
          originalOrders[
            permutationIndex
          ][entryIndex],
        );
      }
    }

    const outputPredictions = successfulValues[0].predictions;

    for (const successfulValue of successfulValues) {
      for (const permutation of permutations) {
        expect(
          successfulValue.predictions,
        ).not.toBe(permutation);
      }
    }

    for (const permutation of permutations) {
      expect(outputPredictions).not.toBe(permutation);
    }

    for (let i = 0; i < outputPredictions.length; i++) {
      expect(outputPredictions[i]).toBe([
        inferenceA,
        inferenceB,
        inferenceC,
      ][i]);
    }

    for (
      let inferenceIndex = 0;
      inferenceIndex
      < capturedStates.length;
      inferenceIndex += 1
    ) {
      const inference = [inferenceA, inferenceB, inferenceC][inferenceIndex];
      const state = capturedStates[inferenceIndex];

      expect(
        Object.getOwnPropertyNames(inference),
      ).toEqual(state.rootNames);
      expect(
        Object.getOwnPropertySymbols(inference),
      ).toEqual(state.rootSymbols);
      for (
        let entryIndex = 0;
        entryIndex
        < state.scalarEntries.length;
        entryIndex += 1
      ) {
        const [key, expected] = state.scalarEntries[entryIndex];
        expect(
          (inference as Record<string, unknown>)[key],
        ).toBe(expected);
      }
      const probabilitiesDescriptor = Object.getOwnPropertyDescriptor(
        inference,
        'probabilities',
      );
      if (
        probabilitiesDescriptor
        && Object.prototype.hasOwnProperty.call(
          probabilitiesDescriptor,
          'value',
        )
      ) {
        expect(
          probabilitiesDescriptor.value,
        ).toBe(state.probabilitiesReference);
        const probabilities = probabilitiesDescriptor.value as Record<
          string,
          unknown
        >;
        expect(
          probabilities.homeWinProbability,
        ).toBe(state.homeWinProbability);
        expect(
          probabilities.awayWinProbability,
        ).toBe(state.awayWinProbability);
        expect(
          Object.getOwnPropertyNames(probabilities),
        ).toEqual(state.probabilityNames);
        expect(
          Object.getOwnPropertySymbols(probabilities),
        ).toEqual(state.probabilitySymbols);
      }
    }

    for (
      let valueIndex = 1;
      valueIndex
      < successfulValues.length;
      valueIndex += 1
    ) {
      expect(
        successfulValues[valueIndex],
      ).toEqual(successfulValues[0]);
    }
  });

  it('rejects reachable release, model, plan, matrix, config, and manifest lineage mismatches and maps fixed-literal corruption to INFERENCE_INVALID', () => {
    const lineageFields = [
      { key: 'releaseId', value: 'release-2' },
      { key: 'modelId', value: 'model-2' },
      { key: 'planId', value: 'plan-2' },
      { key: 'matrixId', value: 'matrix-2' },
      { key: 'configId', value: 'config-2' },
      { key: 'manifestId', value: 'manifest-2' },
    ];

    for (const field of lineageFields) {
      const first = ensureValidInference(buildValidInference());
      const secondReleaseId = field.key === 'releaseId' ? field.value : 'release-1';
      const second = ensureValidInference(
        buildValidInference({
          [field.key]: field.value,
          releaseId: secondReleaseId,
          gameId: `game-${field.key}`,
          snapshotId: `snapshot-${field.key}`,
          inferenceId: `${secondReleaseId}::snapshot-${field.key}::offline-pregame-inference-v1`,
        }),
      );
      expect(validateMLBOfflinePregameInference(first)).toEqual(
        { ok: true, value: first },
      );
      expect(validateMLBOfflinePregameInference(second)).toEqual(
        { ok: true, value: second },
      );

      const builderResult = buildMLBOfflinePredictionSlate([
        first,
        second,
      ]);
      expect(builderResult.ok).toBe(false);
      if (!builderResult.ok) {
        expect(builderResult.issues).toEqual([
          {
            code: 'SOURCE_IDENTITY_MISMATCH',
            path: `$.inferences[1].${field.key}`,
            message: `${field.key} mismatch`,
          },
        ]);
      }

      const proposed = buildValidSlate([first, second]);
      const validatorResult = validateMLBOfflinePredictionSlate(proposed);
      expect(validatorResult.ok).toBe(false);
      if (!validatorResult.ok) {
        expect(validatorResult.issues).toEqual([
          {
            code: 'SOURCE_IDENTITY_MISMATCH',
            path: `$.predictions[1].${field.key}`,
            message: `${field.key} mismatch`,
          },
        ]);
      }
    }

    const fixedLiteralFields = [
      { key: 'algorithm', value: 'BAD_ALGORITHM' },
      { key: 'decisionPolicy', value: 'BAD_POLICY' },
      { key: 'sport', value: 'NBA' },
      { key: 'target', value: 'BAD_TARGET' },
      { key: 'targetEncoding', value: 'BAD_ENCODING' },
    ];

    for (const field of fixedLiteralFields) {
      const corrupted = buildValidInference({ [field.key]: field.value });
      expect(validateMLBOfflinePregameInference(corrupted).ok).toBe(false);

      const validFirst = ensureValidInference(buildValidInference());
      const result = buildMLBOfflinePredictionSlate([
        validFirst,
        corrupted,
      ]);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.issues).toEqual([
          {
            code: 'INFERENCE_INVALID',
            path: '$.inferences[1]',
            message: 'Invalid inference',
          },
        ]);
      }
    }
  });

  it('rejects mixed official dates while preserving distinct per-game data cutoffs', () => {
    const inferenceA = ensureValidInference(
      buildValidInference({
        gameId: 'game-a',
        snapshotId: 'snapshot-a',
        inferenceId: 'release-1::snapshot-a::offline-pregame-inference-v1',
        officialDate: '2026-08-01',
        dataCutoffAt: '2026-07-30T08:00:00Z',
      }),
    );
    const inferenceB = ensureValidInference(
      buildValidInference({
        gameId: 'game-b',
        snapshotId: 'snapshot-b',
        inferenceId: 'release-1::snapshot-b::offline-pregame-inference-v1',
        officialDate: '2026-08-01',
        dataCutoffAt: '2026-07-30T09:00:00Z',
      }),
    );

    const sameDateResult = buildMLBOfflinePredictionSlate([inferenceA, inferenceB]);
    expect(sameDateResult.ok).toBe(true);
    if (sameDateResult.ok) {
      expect(sameDateResult.value.predictions[0].dataCutoffAt).toBe('2026-07-30T08:00:00Z');
      expect(sameDateResult.value.predictions[1].dataCutoffAt).toBe('2026-07-30T09:00:00Z');
    }

    const inferenceC = ensureValidInference(
      buildValidInference({
        gameId: 'game-c',
        snapshotId: 'snapshot-c',
        inferenceId: 'release-1::snapshot-c::offline-pregame-inference-v1',
        officialDate: '2026-08-02',
        dataCutoffAt: '2026-07-30T10:00:00Z',
      }),
    );

    const mixedDateResult = buildMLBOfflinePredictionSlate([
      inferenceA,
      inferenceC,
    ]);
    expect(mixedDateResult.ok).toBe(false);
    if (!mixedDateResult.ok) {
      expect(mixedDateResult.issues).toEqual([
        { code: 'OFFICIAL_DATE_MISMATCH', path: '$.inferences', message: 'officialDate mismatch' },
      ]);
    }
  });

  it('rejects duplicate inference IDs at the second conflicting entry', () => {
    const inferenceA = ensureValidInference(buildValidInference());
    const duplicate = ensureValidInference(
      buildValidInference({
        gameId: 'game-x',
        snapshotId: BASE_SNAPSHOT_ID,
        inferenceId: inferenceA.inferenceId,
      }),
    );

    const result = buildMLBOfflinePredictionSlate([
      inferenceA,
      duplicate,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'DUPLICATE_INFERENCE_ID',
          path: '$.inferences[1]',
          message: `Duplicate inferenceId: ${inferenceA.inferenceId}`,
        },
      ]);
    }
  });

  it('proves duplicate snapshot identity collapses to the locked duplicate inference identity', () => {
    const inferenceA = ensureValidInference(buildValidInference());
    const duplicate = ensureValidInference(
      buildValidInference({
        gameId: 'game-x',
        snapshotId: BASE_SNAPSHOT_ID,
        inferenceId: inferenceA.inferenceId,
      }),
    );

    expect(inferenceA.inferenceId).toBe(duplicate.inferenceId);
    expect(validateMLBOfflinePregameInference(inferenceA).ok).toBe(true);
    expect(validateMLBOfflinePregameInference(duplicate).ok).toBe(true);

    const result = buildMLBOfflinePredictionSlate([
      inferenceA,
      duplicate,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'DUPLICATE_INFERENCE_ID',
          path: '$.inferences[1]',
          message: `Duplicate inferenceId: ${inferenceA.inferenceId}`,
        },
      ]);
    }
  });

  it('rejects duplicate game IDs at the second conflicting entry', () => {
    const inferenceA = ensureValidInference(buildValidInference());
    const duplicate = ensureValidInference(
      buildValidInference({
        snapshotId: 'snapshot-x',
        inferenceId: 'release-1::snapshot-x::offline-pregame-inference-v1',
        gameId: inferenceA.gameId,
      }),
    );

    const result = buildMLBOfflinePredictionSlate([
      inferenceA,
      duplicate,
    ]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toEqual([
        {
          code: 'DUPLICATE_GAME_ID',
          path: '$.inferences[1]',
          message: `Duplicate gameId: ${inferenceA.gameId}`,
        },
      ]);
    }
  });

  it('validates canonical proposed-slate order and rejects non-canonical prediction order', () => {
    const inferenceA = ensureValidInference(
      buildValidInference({
        gameId: 'game-a',
        snapshotId: 'snapshot-a',
        inferenceId: 'release-1::snapshot-a::offline-pregame-inference-v1',
      }),
    );
    const inferenceB = ensureValidInference(
      buildValidInference({
        gameId: 'game-b',
        snapshotId: 'snapshot-b',
        inferenceId: 'release-1::snapshot-b::offline-pregame-inference-v1',
      }),
    );

    const canonicalSlate = buildValidSlate([inferenceA, inferenceB]);
    const canonicalResult = validateMLBOfflinePredictionSlate(canonicalSlate);
    expect(canonicalResult.ok).toBe(true);

    const nonCanonicalSlate = buildValidSlate([inferenceB, inferenceA]);
    const nonCanonicalResult = validateMLBOfflinePredictionSlate(nonCanonicalSlate);
    expect(nonCanonicalResult.ok).toBe(false);
    if (!nonCanonicalResult.ok) {
      expect(nonCanonicalResult.issues).toEqual([
        { code: 'ORDER_MISMATCH', path: '$.predictions', message: 'Predictions must be in canonical order' },
      ]);
    }

    const builderResult = buildMLBOfflinePredictionSlate([
      inferenceB,
      inferenceA,
    ]);
    expect(builderResult.ok).toBe(true);
    if (builderResult.ok) {
      expect(builderResult.value.predictions[0]).toBe(inferenceA);
      expect(builderResult.value.predictions[1]).toBe(inferenceB);
    }
  });

  it('preserves exact prediction object references and all per-game Phase 8J lineage', () => {
    const inference = ensureValidInference(buildValidInference());
    const result = buildMLBOfflinePredictionSlate([inference]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.predictions[0]).toBe(inference);
      expect(result.value.predictions[0].releaseId).toBe(inference.releaseId);
      expect(result.value.predictions[0].snapshotId).toBe(inference.snapshotId);
      expect(result.value.predictions[0].gameId).toBe(inference.gameId);
      expect(result.value.predictions[0].officialDate).toBe(inference.officialDate);
      expect(result.value.predictions[0].dataCutoffAt).toBe(inference.dataCutoffAt);
      expect(result.value.predictions[0].probabilities).toBe(inference.probabilities);
    }
  });

  it('rejects odds contamination, market concepts, recommendations, multis, stakes, grading, and prohibited fields', () => {
    const contaminatedInference = buildValidInference({
      odds: 1.5,
      recommendation: 'pick',
      multi: ['leg1'],
      stake: 10,
      grade: 'PASS',
    });
    expect(validateMLBOfflinePregameInference(contaminatedInference).ok).toBe(false);

    const validInference = ensureValidInference(buildValidInference());
    const proposed = buildValidSlate([validInference], {
      odds: 1.5,
      recommendationCount: 1,
    });
    const result = validateMLBOfflinePredictionSlate(proposed);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const codes = result.issues.map((issue) => issue.code);
      expect(codes).toContain('PROHIBITED_CONCEPT');
      expect(codes).toContain('ODDS_CONTAMINATION');
    }
  });

  it('proves successful output contains no raw features, missing flags, coefficients, scores, metrics, labels, rows, odds, recommendations, multis, stakes, or grades', () => {
    const inference = ensureValidInference(buildValidInference());
    const result = buildMLBOfflinePredictionSlate([inference]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ownPaths: string[] = [];
      const collect = (value: unknown, prefix: string): void => {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          const record = value as Record<string, unknown>;
          for (const key of Object.getOwnPropertyNames(record)) {
            const descriptor = Object.getOwnPropertyDescriptor(record, key);
            if (descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
              ownPaths.push(`${prefix}.${key}`);
              collect(descriptor.value, `${prefix}.${key}`);
            }
          }
        } else if (Array.isArray(value)) {
          for (let i = 0; i < value.length; i++) {
            const itemDescriptor = Object.getOwnPropertyDescriptor(value, i);
            if (itemDescriptor && Object.prototype.hasOwnProperty.call(itemDescriptor, 'value')) {
              collect(itemDescriptor.value, `${prefix}[${i}]`);
            }
          }
        }
      };
      collect(result.value, '$');

      const prohibitedNames = [
        'odds',
        'price',
        'line',
        'market',
        'edge',
        'value',
        'recommendation',
        'multi',
        'parlay',
        'stake',
        'grade',
        'feature',
        'missing',
        'coefficient',
        'intercept',
        'rawScore',
        'score',
        'metric',
        'label',
        'row',
      ];

      for (const name of prohibitedNames) {
        const matches = ownPaths.filter((path) => {
          const segments = path.split('.');
          const last = segments[segments.length - 1];
          return last === name;
        });
        expect(matches).toEqual([]);
      }
    }
  });

  it('verifies deterministic issue ordering, deduplication, exact fields, count mismatch, slate-ID mismatch, and negative-zero rejection', () => {
    const inference = ensureValidInference(buildValidInference());

    const duplicateIssueSlate = buildValidSlate([inference, inference]);
    const duplicateResult = validateMLBOfflinePredictionSlate(duplicateIssueSlate);
    expect(duplicateResult.ok).toBe(false);
    if (!duplicateResult.ok) {
      expect(duplicateResult.issues).toEqual([
        { code: 'DUPLICATE_INFERENCE_ID', path: '$.predictions[1]', message: `Duplicate inferenceId: ${inference.inferenceId}` },
      ]);
    }

    const countMismatchSlate = buildValidSlate([inference], {
      predictionCount: 2,
    });
    const countResult = validateMLBOfflinePredictionSlate(countMismatchSlate);
    expect(countResult.ok).toBe(false);
    if (!countResult.ok) {
      expect(countResult.issues).toEqual([
        { code: 'PREDICTION_COUNT_MISMATCH', path: '$.predictionCount', message: 'predictionCount must equal predictions.length' },
      ]);
    }

    const badIdSlate = buildValidSlate([inference], {
      slateId: 'wrong::slate::id',
    });
    const badIdResult = validateMLBOfflinePredictionSlate(badIdSlate);
    expect(badIdResult.ok).toBe(false);
    if (!badIdResult.ok) {
      expect(badIdResult.issues).toEqual([
        { code: 'SLATE_ID_MISMATCH', path: '$.slateId', message: 'slateId does not match the deterministic formula' },
      ]);
    }

    const negativeZeroSlate = buildValidSlate([inference], {
      predictionCount: -0,
    });
    const negativeZeroResult = validateMLBOfflinePredictionSlate(negativeZeroSlate);
    expect(negativeZeroResult.ok).toBe(false);
    if (!negativeZeroResult.ok) {
      expect(negativeZeroResult.issues).toEqual([
        { code: 'INVALID_NUMBER', path: '$.predictionCount', message: 'predictionCount must not be negative zero' },
      ]);
    }

    const multiIssueSlate = buildValidSlate([inference], {
      unknownField: true,
      generatedAt: 'now',
    });
    const multiResult = validateMLBOfflinePredictionSlate(multiIssueSlate);
    expect(multiResult.ok).toBe(false);
    if (!multiResult.ok) {
      expect(multiResult.issues).toEqual([
        { code: 'PROHIBITED_CONCEPT', path: '$.generatedAt', message: 'Prohibited field: generatedAt' },
        { code: 'UNKNOWN_FIELD', path: '$.unknownField', message: 'Unknown field: unknownField' },
      ]);
    }
  });

  it('verifies exact exports and imports, no live inference, no fitting, no persistence, no routes, no UI, and the static architecture boundary', async () => {
    const source = await readFile(
      new URL(
        '../../../src/prediction/mlb/mlb-offline-prediction-slate-contract.ts',
        import.meta.url,
      ).pathname,
      'utf8',
    );
    const tests = await readFile(
      new URL(
        '../../../tests/prediction/mlb/mlb-offline-prediction-slate-contract.test.ts',
        import.meta.url,
      ).pathname,
      'utf8',
    );

    const exports = Array.from(
      source.matchAll(/\bexport\s+(?:const|type|function)\s+([A-Za-z0-9_]+)/g),
    ).map((match) => match[1]);
    expect(exports).toEqual([
      'MLB_OFFLINE_PREDICTION_SLATE_CONTRACT_VERSION',
      'MLB_OFFLINE_PREDICTION_SLATE_ORDER_POLICY',
      'MLBOfflinePredictionSlateEntry',
      'MLBOfflinePredictionSlate',
      'MLBOfflinePredictionSlateIssue',
      'validateMLBOfflinePredictionSlate',
      'buildMLBOfflinePredictionSlate',
    ]);

    const imports = Array.from(
      source.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g),
    ).map((match) => match[1]);
    const uniqueImports = Array.from(new Set(imports));
    expect(uniqueImports).toEqual([
      '../firewall/odds-contamination-guard',
      './mlb-offline-pregame-inference-contract',
    ]);

    const titles = Array.from(
      tests.matchAll(/\bit\s*\(\s*['"]([^'"]+)['"]/g),
    ).map((match) => match[1]);
    expect(titles).toHaveLength(20);

    expect(source).not.toMatch(/\binferMLBOfflinePregameWinner\s*\(/);
    expect(source).not.toMatch(/\bextractMLBLeakageSafeFeatureVector\s*\(/);
    expect(source).not.toMatch(/\bfitModel\s*\(/);
    expect(source).not.toMatch(/\btrainModel\s*\(/);
    expect(source).not.toMatch(/\bcalibrate/);
    expect(source).not.toMatch(/\bgenerateRecommendation\s*\(/);
    expect(source).not.toMatch(/\bbuildMulti\s*\(/);
    expect(source).not.toMatch(/\bcalculateStake\s*\(/);
    expect(source).not.toMatch(/\bgradePrediction\s*\(/);
    expect(source).not.toMatch(/@\/prediction\/mlb\/mlb-pregame-snapshot-contract/);
    expect(source).not.toMatch(/@\/prediction\/mlb\/mlb-feature-vector-contract/);
    expect(source).not.toMatch(/@\/prediction\/mlb\/mlb-model-test-release-contract/);
    expect(source).not.toMatch(/@\/prediction\/mlb\/mlb-logistic-regression-fit-contract/);
    expect(source).not.toMatch(/\bPrismaClient\b/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/\bprocess\.env\b/);
    expect(source).not.toMatch(/\bDate\.now\s*\(/);
    expect(source).not.toMatch(/\bMath\.random\s*\(/);
    expect(source).not.toMatch(/\brandomUUID\s*\(/);
    expect(source).not.toMatch(/\breadFileSync\b/);
    expect(source).not.toMatch(/\bwriteFileSync\b/);
    expect(source).not.toMatch(/\blocaleCompare\s*\(/);
    expect(tests).not.toMatch(/\bit\.\s*each\s*\(/);
    expect(tests).not.toMatch(/\btest\.\s*each\s*\(/);
  });
});
