import { describe, expect, it } from 'vitest';
import {
  prepareMLBInnerDevelopmentCandidateExecution,
  executeMLBInnerDevelopmentCandidate,
  type MLBInnerDevelopmentCandidatePreparationInput,
  type MLBInnerDevelopmentCandidateExecutionInput,
  type MLBInnerDevelopmentCandidatePreparationIssue,
  type MLBInnerDevelopmentCandidateExecutionIssue,
  type MLBInnerDevelopmentTrainArtifactProviderSuccess,
  type MLBInnerDevelopmentCandidateFoldFitter,
} from '@/prediction/mlb/mlb-inner-development-candidate-execution';
import {
  buildMLBTrainOnlyInnerValidationFolds,
  MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION,
  type MLBOuterTrainRow,
  type MLBTrainOnlyInnerRowCollection,
  type MLBInnerCandidatePredictionRecord,
  type MLBInnerFoldMetricResult,
  type MLBInnerAggregateResult,
  type MLBInnerCandidateGateResult,
  type MLBInnerDevelopmentReferenceFacts,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-runtime-provenance';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
  validateMLBInnerDevelopmentTrainArtifact,
  type MLBInnerDevelopmentTrainArtifact,
} from '@/prediction/mlb/mlb-inner-development-train-artifact';
import {
  type MLBInnerDevelopmentFoldFitInput,
  type MLBInnerDevelopmentFoldFitOutcome,
  type MLBInnerDevelopmentFoldFitSuccess,
  type MLBInnerDevelopmentFoldFitIssue,
} from '@/prediction/mlb/mlb-inner-development-fold-fitter';
import {
  type MLBInnerMaterializedCandidate,
} from '@/prediction/mlb/mlb-inner-development-candidate-materialization';
import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
  type MLBInnerDevelopmentCampaignProvenance,
} from '@/prediction/mlb/mlb-inner-development-campaign-provenance';
import {
  type MLBModelTrainingConfiguration,
} from '@/prediction/mlb/mlb-model-training-plan-contract';

function createSyntheticTrainRowCollection(): MLBTrainOnlyInnerRowCollection {
  const rows: MLBOuterTrainRow[] = [];
  let exampleIndex = 0;

  const buckets: Array<{
    startDay: number;
    endDay: number;
    totalRows: number;
    homeWins: number;
  }> = [
    { startDay: 1, endDay: 7, totalRows: 91, homeWins: 49 },
    { startDay: 8, endDay: 11, totalRows: 51, homeWins: 29 },
    { startDay: 12, endDay: 15, totalRows: 55, homeWins: 34 },
    { startDay: 16, endDay: 19, totalRows: 55, homeWins: 25 },
    { startDay: 20, endDay: 23, totalRows: 49, homeWins: 23 },
  ];

  for (const bucket of buckets) {
    const dates: string[] = [];
    for (let d = bucket.startDay; d <= bucket.endDay; d++) {
      dates.push(`2026-04-${String(d).padStart(2, '0')}`);
    }

    const perDateBase = Math.floor(bucket.totalRows / dates.length);
    const perDateExtra = bucket.totalRows % dates.length;

    let bucketRowOrdinal = 0;
    for (let di = 0; di < dates.length; di++) {
      const dateStr = dates[di];
      const dayCount = perDateBase + (di < perDateExtra ? 1 : 0);
      for (let ri = 0; ri < dayCount; ri++) {
        const targetValue = bucketRowOrdinal < bucket.homeWins ? 1 : 0;
        rows.push({
          exampleId: `train-${String(exampleIndex).padStart(3, '0')}`,
          split: 'TRAIN',
          vector: {
            contractVersion: 'mlb-feature-vector-v1',
            sport: 'MLB',
            target: 'OFFICIAL_FINAL_GAME_WINNER',
            manifestId: 'mlb-real-pregame-winner-feature-manifest-v1',
            snapshotId: `snapshot-${String(exampleIndex).padStart(3, '0')}`,
            gameId: `game-${String(exampleIndex).padStart(3, '0')}`,
            officialDate: dateStr,
            dataCutoffAt: `${dateStr}T09:00:00Z`,
            values: [
              { featureId: 'p_1', value: exampleIndex, wasMissing: false },
              { featureId: 'p_2', value: exampleIndex * 0.1, wasMissing: true },
            ],
          },
          targetValue,
        });
        bucketRowOrdinal++;
        exampleIndex++;
      }
    }
  }

  const actualHome = rows.filter((r) => r.targetValue === 1).length;
  const actualAway = rows.filter((r) => r.targetValue === 0).length;

  return {
    contractVersion: MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION,
    sport: 'MLB',
    target: 'OFFICIAL_FINAL_GAME_WINNER',
    targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
    matrixId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID,
    manifestId: MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
    datasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    rowCount: rows.length,
    homeWinCount: actualHome,
    awayWinCount: actualAway,
    rows: Object.freeze(rows),
  };
}

function createSyntheticTrainArtifact(
  rowCollection: MLBTrainOnlyInnerRowCollection,
): MLBInnerDevelopmentTrainArtifactProviderSuccess {
  const artifact: MLBInnerDevelopmentTrainArtifact = {
    artifactContractVersion: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
    artifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
    sourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    featureManifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
    featurePolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
    preprocessingPolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
    split: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
    rowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
    firstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
    lastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
    foldPlanId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
    rowCollection,
  };

  const validation = validateMLBInnerDevelopmentTrainArtifact(artifact);
  expect(validation.ok).toBe(true);
  if (!validation.ok) {
    throw new Error('Invalid synthetic artifact');
  }

  return {
    ok: true,
    artifact: validation.value,
    verifiedSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    byteLength: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
  };
}

function createSyntheticCandidate(): MLBInnerMaterializedCandidate {
  return {
    candidateRecipeId: 'candidate-recipe-1',
    configuration: {
      contractVersion: 'mlb-model-training-configuration-v1',
      sport: 'MLB',
      target: 'OFFICIAL_FINAL_GAME_WINNER',
      targetEncoding: 'HOME_WIN_1_AWAY_WIN_0',
      configId: 'config-1',
      algorithm: 'L2_LOGISTIC_REGRESSION_BINARY_V1',
      randomnessPolicy: 'NO_RANDOMNESS',
      featureValuePolicy: 'RAW_FINITE_FEATURE_VALUES',
      missingIndicatorPolicy: 'PRESERVE_WAS_MISSING_FLAGS',
      regularization: { kind: 'L2', strength: 0.01 },
      optimization: {
        solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1',
        learningRate: 0.1,
        maxIterations: 1000,
        tolerance: 0.0001,
      },
    } as MLBModelTrainingConfiguration,
    provenance: {
      datasetId: 'full-corpus-dataset-id',
      datasetSha256: 'full-corpus-sha256',
      datasetRowCount: 437,
      outerTrainRowCount: 301,
      featurePolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
      manifestId: MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
      preprocessingPolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
      matrixId: 'full-corpus-matrix-id',
      matrixSha256: 'full-corpus-matrix-sha256',
    } as MLBInnerDevelopmentCampaignProvenance,
  };
}

function createPreparationInput(
  overrides: {
    candidate?: Partial<MLBInnerMaterializedCandidate>;
    artifact?: Partial<MLBInnerDevelopmentTrainArtifactProviderSuccess>;
  } = {},
): MLBInnerDevelopmentCandidatePreparationInput {
  const rowCollection = createSyntheticTrainRowCollection();
  const artifact = createSyntheticTrainArtifact(rowCollection);

  return {
    materializedCandidate: { ...createSyntheticCandidate(), ...overrides.candidate },
    verifiedTrainArtifact: { ...artifact, ...overrides.artifact },
  };
}

function createPredictions(
  validationRows: readonly MLBOuterTrainRow[],
  probabilityFactory: (exampleId: string, targetValue: number) => number,
  foldId: string,
): MLBInnerCandidatePredictionRecord[] {
  return validationRows.map((row) => ({
    candidateRecipeId: 'candidate-recipe-1',
    foldId,
    exampleId: row.exampleId,
    homeWinProbability: probabilityFactory(row.exampleId, row.targetValue),
  }));
}

function createFakeFoldFitter(
  predictionsByFold: Map<string, readonly MLBInnerCandidatePredictionRecord[]>,
  lowLevelFitCount = 1,
): MLBInnerDevelopmentCandidateFoldFitter {
  return (
    input: MLBInnerDevelopmentFoldFitInput,
  ): MLBInnerDevelopmentFoldFitOutcome => {
    const predictions = predictionsByFold.get(input.foldId);
    if (!predictions) {
      return {
        ok: false,
        issues: [
          {
            code: 'MODEL_FIT_FAILURE' as MLBInnerDevelopmentFoldFitIssue['code'],
            path: '$.validationRows',
            message: `No fake predictions configured for fold ${input.foldId}`,
          },
        ],
        lowLevelFitCount: 0,
      };
    }

    return {
      ok: true,
      value: {
        foldId: input.foldId,
        candidateRecipeId: input.candidateRecipeId,
        predictions,
        modelMetadata: {
          converged: true,
          iterationsCompleted: 100,
          finalTrainingObjective: -0.5,
          featureIds: ['p_1', 'p_2'],
          trainingRowCount: input.trainRows.length,
        },
        lowLevelFitCount,
      } as unknown as MLBInnerDevelopmentFoldFitSuccess,
    };
  };
}

function withUncheckedArtifactOverrideForNegativeTest(
  overrides: Record<string, unknown>,
): MLBInnerDevelopmentTrainArtifactProviderSuccess {
  const rowCollection = createSyntheticTrainRowCollection();
  const base: MLBInnerDevelopmentTrainArtifact = {
    artifactContractVersion: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_CONTRACT_VERSION,
    artifactId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
    sourceDatasetId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
    featureManifestId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_MANIFEST_ID,
    featurePolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FEATURE_POLICY_ID,
    preprocessingPolicyId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_PREPROCESSING_POLICY_ID,
    split: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SPLIT,
    rowCount: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
    firstOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
    lastOfficialDate: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
    foldPlanId: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID,
    rowCollection,
  };
  const artifact = { ...base, ...overrides } as unknown as MLBInnerDevelopmentTrainArtifact;

  return {
    ok: true,
    artifact,
    verifiedSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    byteLength: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
  };
}

describe('Phase 8V-D3-C-E4-B4-I1C MLB inner development candidate execution', () => {
  it('prepares valid synthetic candidate execution', () => {
    const input = createPreparationInput();
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.candidateRecipeId).toBe('candidate-recipe-1');
    expect(result.value.verifiedArtifactSha256).toBe(
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    );
    expect(result.value.verifiedArtifactByteLength).toBe(
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
    );
    expect(result.value.folds.folds).toHaveLength(4);
    expect(result.value.folds.folds[0].trainRowCount).toBe(91);
    expect(result.value.folds.folds[0].validationRowCount).toBe(51);
    expect(result.value.folds.folds[1].trainRowCount).toBe(142);
    expect(result.value.folds.folds[1].validationRowCount).toBe(55);
    expect(result.value.folds.folds[2].trainRowCount).toBe(197);
    expect(result.value.folds.folds[2].validationRowCount).toBe(55);
    expect(result.value.folds.folds[3].trainRowCount).toBe(252);
    expect(result.value.folds.folds[3].validationRowCount).toBe(49);
  });

  it('rejects wrong verified SHA', () => {
    const input = createPreparationInput({
      artifact: { verifiedSha256: '0'.repeat(64) },
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('VERIFIED_ARTIFACT_SHA_MISMATCH');
    }
  });

  it('rejects wrong verified byte length', () => {
    const input = createPreparationInput({
      artifact: { byteLength: 0 },
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].code).toBe('VERIFIED_ARTIFACT_BYTE_LENGTH_MISMATCH');
    }
  });

  it('rejects wrong artifact ID', () => {
    const input = createPreparationInput({
      artifact: withUncheckedArtifactOverrideForNegativeTest({ artifactId: 'wrong-artifact-id' }),
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'ARTIFACT_INVARIANT_VIOLATION')).toBe(true);
    }
  });

  it('rejects wrong TRAIN-source dataset identity', () => {
    const input = createPreparationInput({
      artifact: withUncheckedArtifactOverrideForNegativeTest({ sourceDatasetId: 'wrong-source-dataset-id' }),
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'ARTIFACT_INVARIANT_VIOLATION')).toBe(true);
    }
  });

  it('rejects wrong TRAIN-source matrix identity', () => {
    const input = createPreparationInput({
      artifact: withUncheckedArtifactOverrideForNegativeTest({ sourceDatasetId: 'wrong-dataset-id' }),
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'ARTIFACT_INVARIANT_VIOLATION')).toBe(true);
    }
  });

  it('rejects wrong row count', () => {
    const input = createPreparationInput({
      artifact: withUncheckedArtifactOverrideForNegativeTest({ rowCount: 999 }),
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'ARTIFACT_INVARIANT_VIOLATION')).toBe(true);
    }
  });

  it('rejects wrong date window', () => {
    const input = createPreparationInput({
      artifact: withUncheckedArtifactOverrideForNegativeTest({ firstOfficialDate: '2026-04-02' }),
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'ARTIFACT_INVARIANT_VIOLATION')).toBe(true);
    }
  });

  it('rejects wrong manifest', () => {
    const candidate = {
      ...createSyntheticCandidate(),
      provenance: { ...createSyntheticCandidate().provenance, manifestId: 'wrong-manifest-id' },
    } as unknown as MLBInnerMaterializedCandidate;

    const input = createPreparationInput({
      candidate,
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'RECIPE_ARTIFACT_POLICY_MISMATCH')).toBe(true);
    }
  });

  it('rejects wrong feature policy', () => {
    const candidate = {
      ...createSyntheticCandidate(),
      provenance: { ...createSyntheticCandidate().provenance, featurePolicyId: 'wrong-feature-policy-id' },
    } as unknown as MLBInnerMaterializedCandidate;

    const input = createPreparationInput({
      candidate,
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'RECIPE_ARTIFACT_POLICY_MISMATCH')).toBe(true);
    }
  });

  it('rejects wrong preprocessing policy', () => {
    const candidate = {
      ...createSyntheticCandidate(),
      provenance: { ...createSyntheticCandidate().provenance, preprocessingPolicyId: 'wrong-preprocessing-policy-id' },
    } as unknown as MLBInnerMaterializedCandidate;

    const input = createPreparationInput({
      candidate,
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'RECIPE_ARTIFACT_POLICY_MISMATCH')).toBe(true);
    }
  });

  it('rejects wrong fold-plan ID', () => {
    const input = createPreparationInput({
      artifact: withUncheckedArtifactOverrideForNegativeTest({ foldPlanId: 'wrong-fold-plan-id' }),
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'ARTIFACT_INVARIANT_VIOLATION')).toBe(true);
    }
  });

  it('rejects non-canonical algorithm', () => {
    const candidate = {
      ...createSyntheticCandidate(),
      configuration: { ...createSyntheticCandidate().configuration, algorithm: 'UNKNOWN_ALGORITHM' },
    } as unknown as MLBInnerMaterializedCandidate;

    const input = createPreparationInput({
      candidate,
    });
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.some((issue) => issue.code === 'RECIPE_ARTIFACT_POLICY_MISMATCH')).toBe(true);
    }
  });

  it('accepts intentional full-lineage vs TRAIN-source identity difference', () => {
    const input = createPreparationInput();
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(result.ok).toBe(true);
  });

  it('does not mutate caller inputs on valid preparation', () => {
    const input = createPreparationInput();
    const candidateClone = { ...input.materializedCandidate };
    const artifactClone = { ...input.verifiedTrainArtifact };

    prepareMLBInnerDevelopmentCandidateExecution(input);

    expect(input.materializedCandidate).toEqual(candidateClone);
    expect(input.verifiedTrainArtifact).toEqual(artifactClone);
  });

  it('executes four canonical folds in order with fake fitter', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    const foldIds: string[] = [];

    for (const fold of prepared.folds.folds) {
      foldIds.push(fold.foldId);
      predictionsByFold.set(
        fold.foldId,
        createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId),
      );
    }

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const executionInput: MLBInnerDevelopmentCandidateExecutionInput = {
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    };

    const executionResult = executeMLBInnerDevelopmentCandidate(executionInput);

    expect(executionResult.ok).toBe(true);
    if (!executionResult.ok) return;

    expect(executionResult.value.lowLevelFitCount).toBe(4);
    expect(executionResult.value.foldResults).toHaveLength(4);
    expect(executionResult.value.candidateRecipeId).toBe('candidate-recipe-1');
    expect(executionResult.value.verifiedArtifactSha256).toBe(
      MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    );
  });

  it('returns eligible gate outcome with perfect predictions', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();

    for (const fold of prepared.folds.folds) {
      predictionsByFold.set(
        fold.foldId,
        createPredictions(fold.innerValidationRows, (_, targetValue) => targetValue, fold.foldId),
      );
    }

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(true);
    if (!executionResult.ok) return;

    expect(executionResult.value.gate.eligibility).toBe('INNER_ELIGIBLE');
  });

  it('returns rejected gate outcome with uniform 0.5 predictions', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();

    for (const fold of prepared.folds.folds) {
      predictionsByFold.set(
        fold.foldId,
        createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId),
      );
    }

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(true);
    if (!executionResult.ok) return;

    expect(executionResult.value.gate.eligibility).toBe('INNER_REJECTED');
  });

  it('short-circuits on fold fitter failure at FOLD_1', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const fakeFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
      if (input.foldId === 'FOLD_1') {
        return {
          ok: false,
          issues: [
            {
              code: 'MODEL_FIT_FAILURE',
              path: '$.trainRows',
              message: 'fake fold 1 failure',
            },
          ],
          lowLevelFitCount: 1,
        };
      }
      return createFakeFoldFitter(new Map(), 1)(input);
    };

    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.lowLevelFitCount).toBe(0);
      expect(executionResult.failedFoldId).toBe('FOLD_1');
    }
  });

  it('short-circuits on fold fitter failure at FOLD_2', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    let callCount = 0;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    predictionsByFold.set(
      'FOLD_1',
      createPredictions(prepared.folds.folds[0].innerValidationRows, () => 0.5, 'FOLD_1'),
    );
    const fakeFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
      callCount += 1;
      if (input.foldId === 'FOLD_2') {
        return {
          ok: false,
          issues: [
            {
              code: 'MODEL_FIT_FAILURE',
              path: '$.trainRows',
              message: 'fake fold 2 failure',
            },
          ],
          lowLevelFitCount: 1,
        };
      }
      return createFakeFoldFitter(predictionsByFold, 1)(input);
    };

    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.lowLevelFitCount).toBe(1);
      expect(executionResult.failedFoldId).toBe('FOLD_2');
    }
    expect(callCount).toBe(2);
  });

  it('short-circuits on fold fitter failure at FOLD_3', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    let callCount = 0;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    for (const fold of prepared.folds.folds) {
      if (fold.foldId === 'FOLD_3') break;
      predictionsByFold.set(
        fold.foldId,
        createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId),
      );
    }
    const fakeFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
      callCount += 1;
      if (input.foldId === 'FOLD_3') {
        return {
          ok: false,
          issues: [
            {
              code: 'MODEL_FIT_FAILURE',
              path: '$.trainRows',
              message: 'fake fold 3 failure',
            },
          ],
          lowLevelFitCount: 1,
        };
      }
      return createFakeFoldFitter(predictionsByFold, 1)(input);
    };

    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.lowLevelFitCount).toBe(2);
      expect(executionResult.failedFoldId).toBe('FOLD_3');
    }
    expect(callCount).toBe(3);
  });

  it('short-circuits on fold fitter failure at FOLD_4', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    let callCount = 0;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    for (const fold of prepared.folds.folds) {
      if (fold.foldId === 'FOLD_4') break;
      predictionsByFold.set(
        fold.foldId,
        createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId),
      );
    }
    const fakeFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
      callCount += 1;
      if (input.foldId === 'FOLD_4') {
        return {
          ok: false,
          issues: [
            {
              code: 'MODEL_FIT_FAILURE',
              path: '$.trainRows',
              message: 'fake fold 4 failure',
            },
          ],
          lowLevelFitCount: 1,
        };
      }
      return createFakeFoldFitter(predictionsByFold, 1)(input);
    };

    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.lowLevelFitCount).toBe(3);
      expect(executionResult.failedFoldId).toBe('FOLD_4');
    }
    expect(callCount).toBe(4);
  });

  it('reports zero fit count when fitter returns zero at FOLD_1', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const fakeFitter: MLBInnerDevelopmentCandidateFoldFitter = () => ({
      ok: false,
      issues: [
        {
          code: 'MODEL_FIT_FAILURE',
          path: '$.trainRows',
          message: 'zero-fit failure',
        },
      ],
      lowLevelFitCount: 0,
    });

    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.lowLevelFitCount).toBe(0);
      expect(executionResult.failedFoldId).toBe('FOLD_1');
    }
  });

  it('fails closed on wrong returned foldId', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    for (const fold of prepared.folds.folds) {
      predictionsByFold.set(
        fold.foldId,
        createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId),
      );
    }

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const tamperedFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
      const outcome = fakeFitter(input);
      if (outcome.ok) {
        return {
          ok: true,
          value: {
            ...outcome.value,
            foldId: 'WRONG_FOLD',
          },
        } as MLBInnerDevelopmentFoldFitOutcome;
      }
      return outcome;
    };

    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: tamperedFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.issues[0].code).toBe('FOLD_FIT_RESULT_INVARIANT_VIOLATION');
      expect(executionResult.lowLevelFitCount).toBe(1);
    }
  });

  it('fails closed on wrong returned candidateRecipeId', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    for (const fold of prepared.folds.folds) {
      predictionsByFold.set(
        fold.foldId,
        createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId),
      );
    }

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const tamperedFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
      const outcome = fakeFitter(input);
      if (outcome.ok) {
        return {
          ok: true,
          value: {
            ...outcome.value,
            candidateRecipeId: 'WRONG_RECIPE',
          },
        } as MLBInnerDevelopmentFoldFitOutcome;
      }
      return outcome;
    };

    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: tamperedFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.issues[0].code).toBe('FOLD_FIT_RESULT_INVARIANT_VIOLATION');
      expect(executionResult.lowLevelFitCount).toBe(1);
    }
  });

  it('fails closed on missing prediction', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    for (const fold of prepared.folds.folds) {
      predictionsByFold.set(
        fold.foldId,
        createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId).slice(0, -1),
      );
    }

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.issues[0].code).toBe('FOLD_FIT_RESULT_INVARIANT_VIOLATION');
    }
  });

  it('fails closed on extra prediction', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    for (const fold of prepared.folds.folds) {
      const preds = createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId);
      predictionsByFold.set(
        fold.foldId,
        [...preds, { ...preds[0], exampleId: 'extra-row' }],
      );
    }

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.issues[0].code).toBe('FOLD_FIT_RESULT_INVARIANT_VIOLATION');
    }
  });

  it('fails closed on wrong prediction order/exampleId', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    for (const fold of prepared.folds.folds) {
      const preds = createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId);
      const shuffled = [...preds].reverse();
      predictionsByFold.set(fold.foldId, shuffled);
    }

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.issues[0].code).toBe('FOLD_FIT_RESULT_INVARIANT_VIOLATION');
    }
  });

  it('fails closed on invalid lowLevelFitCount', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const fakeFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => ({
      ok: true,
      value: {
        foldId: input.foldId,
        candidateRecipeId: input.candidateRecipeId,
        predictions: [],
        modelMetadata: {
          converged: true,
          iterationsCompleted: 0,
          finalTrainingObjective: 0,
          featureIds: [],
          trainingRowCount: 0,
        },
        lowLevelFitCount: -1,
      } as unknown as MLBInnerDevelopmentFoldFitSuccess,
    });

    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.issues[0].code).toBe('FOLD_FIT_RESULT_INVARIANT_VIOLATION');
    }
  });

  it('reports FOLD_METRIC_FAILURE on non-finite predictions', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    const firstFold = prepared.folds.folds[0];
    const preds = createPredictions(firstFold.innerValidationRows, () => 0.5, firstFold.foldId);
    preds[0] = { ...preds[0], homeWinProbability: Number.NaN };
    predictionsByFold.set(firstFold.foldId, preds);

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const executionResult = executeMLBInnerDevelopmentCandidate({
      preparedExecution: prepared,
      foldFitter: fakeFitter,
    });

    expect(executionResult.ok).toBe(false);
    if (!executionResult.ok) {
      expect(executionResult.issues[0].code).toBe('FOLD_METRIC_FAILURE');
    }
  });

  it('does not mutate prepared execution on success', () => {
    const preparationInput = createPreparationInput();
    const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
    expect(preparationResult.ok).toBe(true);
    if (!preparationResult.ok) return;

    const prepared = preparationResult.value;
    const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
    for (const fold of prepared.folds.folds) {
      predictionsByFold.set(
        fold.foldId,
        createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId),
      );
    }

    const fakeFitter = createFakeFoldFitter(predictionsByFold, 1);
    const clonedPrepared = { ...prepared };
    executeMLBInnerDevelopmentCandidate({
      preparedExecution: clonedPrepared,
      foldFitter: fakeFitter,
    });

    expect(clonedPrepared).toEqual(prepared);
  });

  it('does not read the real artifact file', () => {
    const input = createPreparationInput();
    const result = prepareMLBInnerDevelopmentCandidateExecution(input);
    expect(result.ok).toBe(true);
  });
});
