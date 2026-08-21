import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';

import {
  prepareMLBInnerDevelopmentCandidateExecution,
  executeMLBInnerDevelopmentCandidate,
  type MLBInnerDevelopmentCandidatePreparationInput,
  type MLBInnerDevelopmentCandidatePreparationIssue,
  type MLBInnerDevelopmentCandidateExecutionIssue,
  type MLBInnerDevelopmentTrainArtifactProviderSuccess,
  type MLBInnerDevelopmentCandidateFoldFitter,
} from '@/prediction/mlb/mlb-inner-development-candidate-execution';
import {
  type MLBInnerDevelopmentFoldFitInput,
  type MLBInnerDevelopmentFoldFitOutcome,
  type MLBInnerDevelopmentFoldFitSuccess,
  type MLBInnerDevelopmentFoldFitIssue,
} from '@/prediction/mlb/mlb-inner-development-fold-fitter';
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
  type MLBInnerDevelopmentTrainArtifactProviderResult,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-provider';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
} from '@/prediction/mlb/mlb-inner-development-train-artifact-runtime-provenance';
import {
  type MLBInnerMaterializedCandidate,
} from '@/prediction/mlb/mlb-inner-development-candidate-materialization';
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
  MLB_INNER_DEVELOPMENT_CAMPAIGN_MANIFEST_ID,
  type MLBInnerDevelopmentCampaignProvenance,
} from '@/prediction/mlb/mlb-inner-development-campaign-provenance';
import {
  type MLBModelTrainingConfiguration,
} from '@/prediction/mlb/mlb-model-training-plan-contract';
import {
  MLB_INNER_DEVELOPMENT_CYCLE_ID,
  type MLBInnerCandidateRecipe,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  MLB_INNER_DEVELOPMENT_CAMPAIGN_ANCHOR_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_CONTRACT_VERSION,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
  MLB_INNER_DEVELOPMENT_CAMPAIGN_RESET_PREVENTION_ANCHOR,
  validateMLBInnerDevelopmentCampaignAnchor,
  validateMLBInnerDevelopmentCampaignLedger,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger';
import {
  resolveMLBInnerDevelopmentCampaignLedgerStorePaths,
  writeMLBInnerDevelopmentCampaignLedger,
  acquireMLBInnerDevelopmentCampaignLock,
  releaseMLBInnerDevelopmentCampaignLock,
} from '@/prediction/mlb/mlb-inner-development-campaign-ledger-store';
import {
  initializeMLBInnerDevelopmentCampaign,
  inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld,
  MLBInnerDevelopmentCampaignGenesisInput,
} from '@/prediction/mlb/mlb-inner-development-campaign-lifecycle';
import {
  registerMLBInnerDevelopmentCampaignCandidate,
  MLBInnerDevelopmentCampaignRegistrationInput,
} from '@/prediction/mlb/mlb-inner-development-campaign-registration';
import {
  claimMLBInnerDevelopmentAttemptForExecution,
  finalizeMLBInnerDevelopmentAttemptTerminal,
  type MLBInnerDevelopmentAttemptClaimInput,
  type MLBInnerDevelopmentAttemptFinalizeInput,
} from '@/prediction/mlb/mlb-inner-development-campaign-execution';
import {
  orchestrateMLBInnerDevelopmentCandidateExecution,
  type MLBInnerDevelopmentCandidateOrchestrationInput,
  type MLBInnerDevelopmentCandidateOrchestrationResult,
  type MLBInnerDevelopmentVerifiedTrainArtifactProvider,
  type MLBInnerDevelopmentCandidateOrchestrationIssue,
} from '@/prediction/mlb/mlb-inner-development-candidate-orchestration';

const VALID_TIMESTAMP = '2026-04-01T00:00:00.000Z';

function makeGenesisInput(genesisTimestamp: string): MLBInnerDevelopmentCampaignGenesisInput {
  return {
    authorization: 'EXPLICIT_ONE_TIME_GENESIS' as const,
    genesisTimestamp,
  };
}

function makeRecipe(overrides: Partial<MLBInnerCandidateRecipe> = {}): MLBInnerCandidateRecipe {
  return {
    candidateRecipeId: overrides.candidateRecipeId ?? 'synthetic-recipe-1',
    preprocessingPolicyId:
      overrides.preprocessingPolicyId ?? 'raw-finite-feature-values-with-default-missing-v1',
    featurePolicyId: overrides.featurePolicyId ?? 'mlb-real-pregame-winner-feature-policy-v1',
    modelFamilyId: overrides.modelFamilyId ?? 'L2_LOGISTIC_REGRESSION_BINARY_V1',
    regularizationConfig: overrides.regularizationConfig ?? { kind: 'L2', strength: 0.01 },
    optimizerConfig: overrides.optimizerConfig ?? { solver: 'DETERMINISTIC_BATCH_GRADIENT_DESCENT_V1', learningRate: 0.01, maxIterations: 1000, tolerance: 0.0001 },
    otherModelAffectingChoices: overrides.otherModelAffectingChoices ?? {},
    complexityRank: overrides.complexityRank ?? 1,
  };
}

function makeRegistrationInput(overrides: {
  candidateRecipe?: MLBInnerCandidateRecipe;
  registrationTimestamp?: unknown;
  attemptTimestamp?: unknown;
} = {}): MLBInnerDevelopmentCampaignRegistrationInput {
  const candidateRecipe = overrides.candidateRecipe ?? makeRecipe();
  return {
    candidateRecipe,
    registrationTimestamp: (overrides.registrationTimestamp ?? VALID_TIMESTAMP) as string,
    attemptTimestamp: (overrides.attemptTimestamp ?? VALID_TIMESTAMP) as string,
  };
}

async function setupReadyCampaign(tempRoot: string): Promise<void> {
  await initializeMLBInnerDevelopmentCampaign(tempRoot, makeGenesisInput(VALID_TIMESTAMP));
  const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
  expect(inspection.ok).toBe(true);
  if (!inspection.ok) {
    throw new Error('Failed to setup READY campaign');
  }
}

async function registerSyntheticCandidate(tempRoot: string): Promise<number> {
  const registrationInput = makeRegistrationInput();
  const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
  expect(registrationResult.ok).toBe(true);
  if (!registrationResult.ok) {
    throw new Error('Registration failed');
  }
  return registrationResult.value.attemptNumber;
}

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
  candidateRecipeId: string,
): MLBInnerCandidatePredictionRecord[] {
  return validationRows.map((row) => ({
    candidateRecipeId,
    foldId,
    exampleId: row.exampleId,
    homeWinProbability: probabilityFactory(row.exampleId, row.targetValue),
  }));
}

function createFakeFoldFitter(
  predictionsByFold: Map<string, readonly MLBInnerCandidatePredictionRecord[]>,
  lowLevelFitCount: 1 = 1,
): MLBInnerDevelopmentCandidateFoldFitter {
  return (input: MLBInnerDevelopmentFoldFitInput): MLBInnerDevelopmentFoldFitOutcome => {
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
      },
    };
  };
}

function createProviderWithBadVerifiedSha256(): MLBInnerDevelopmentVerifiedTrainArtifactProvider {
  return async () => ({
    ok: true,
    artifact: createSyntheticTrainArtifact(createSyntheticTrainRowCollection()).artifact,
    verifiedSha256: 'wrong-sha-' + 'a'.repeat(56),
    byteLength: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
  });
}

function createSyntheticProviderSuccess(): MLBInnerDevelopmentTrainArtifactProviderSuccess {
  return createSyntheticTrainArtifact(createSyntheticTrainRowCollection());
}

function createSyntheticProviderFailure(): MLBInnerDevelopmentTrainArtifactProviderResult {
  return {
    ok: false,
    issues: [
      {
        code: 'INVARIANT_VIOLATION',
        path: '$',
        message: 'Synthetic provider failure',
      },
    ],
  };
}

function createOrchestrationInput(
  tempRoot: string,
  overrides: {
    candidateRecipeId?: string;
    attemptNumber?: number;
    provider?: MLBInnerDevelopmentVerifiedTrainArtifactProvider;
    foldFitter?: MLBInnerDevelopmentCandidateFoldFitter;
  } = {},
): MLBInnerDevelopmentCandidateOrchestrationInput {
  return {
    repositoryRoot: tempRoot,
    candidateRecipeId: overrides.candidateRecipeId ?? 'synthetic-recipe-1',
    attemptNumber: overrides.attemptNumber ?? 1,
    loadVerifiedTrainArtifact:
      overrides.provider ??
      (async (): Promise<MLBInnerDevelopmentTrainArtifactProviderResult> =>
        createSyntheticProviderSuccess()),
    foldFitter:
      overrides.foldFitter ??
      (() => {
        throw new Error('Fitter should not be called in pre-claim failure');
      }),
  };
}

describe('Phase 8V-D3-C-E4-B4-I2B MLB inner development candidate orchestration', () => {
  let tempRoot: string;

  beforeEach(async () => {
    tempRoot = await fs.mkdtemp(path.join('/tmp', 'mre-orchestration-'));
  });

  afterEach(async () => {
    await fs.rm(tempRoot, { recursive: true, force: true });
  });

  describe('pre-claim failures', () => {
    it('fails closed when campaign is not READY', async () => {
      const ledgerPath = path.join(
        tempRoot,
        MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY,
        MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME,
      );
      await fs.mkdir(path.dirname(ledgerPath), { recursive: true });
      await fs.writeFile(
        ledgerPath,
        JSON.stringify({ developmentCycleId: 'different-cycle' }) + '\n',
        'utf-8',
      );

      let fitterCallCount = 0;
      const fitter: MLBInnerDevelopmentCandidateFoldFitter = () => {
        fitterCallCount += 1;
        throw new Error('Fitter should not be called');
      };

      const input = createOrchestrationInput(tempRoot, { foldFitter: fitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('PREPARATION_OR_CANONICAL_FAILURE');
      expect(fitterCallCount).toBe(0);
    });

    it('fails closed for unregistered candidateRecipeId', async () => {
      await setupReadyCampaign(tempRoot);

      let fitterCallCount = 0;
      const fitter: MLBInnerDevelopmentCandidateFoldFitter = () => {
        fitterCallCount += 1;
        throw new Error('Fitter should not be called');
      };

      const input = createOrchestrationInput(tempRoot, { candidateRecipeId: 'missing-recipe', foldFitter: fitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('PREPARATION_OR_CANONICAL_FAILURE');
      expect(fitterCallCount).toBe(0);
    });

    it('fails closed for missing attemptNumber', async () => {
      await setupReadyCampaign(tempRoot);
      await registerSyntheticCandidate(tempRoot);

      let fitterCallCount = 0;
      const fitter: MLBInnerDevelopmentCandidateFoldFitter = () => {
        fitterCallCount += 1;
        throw new Error('Fitter should not be called');
      };

      const input = createOrchestrationInput(tempRoot, { attemptNumber: 99, foldFitter: fitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('PREPARATION_OR_CANONICAL_FAILURE');
      expect(fitterCallCount).toBe(0);
    });

    it('fails closed when attempt is already RUNNING', async () => {
      await setupReadyCampaign(tempRoot);
      const attemptNumber = await registerSyntheticCandidate(tempRoot);

      const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
        repositoryRoot: tempRoot,
        candidateRecipeId: 'synthetic-recipe-1',
        attemptNumber,
        executionProvenance: {
          verifiedArtifactSha256: 'a'.repeat(64),
          verifiedArtifactByteLength: 1024,
          artifactId: 'artifact-1',
          foldPlanId: 'fold-plan-1',
        },
      };
      const claimResult = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
      expect(claimResult.ok).toBe(true);

      let fitterCallCount = 0;
      const fitter: MLBInnerDevelopmentCandidateFoldFitter = () => {
        fitterCallCount += 1;
        throw new Error('Fitter should not be called');
      };

      const input = createOrchestrationInput(tempRoot, { attemptNumber, foldFitter: fitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('PREPARATION_OR_CANONICAL_FAILURE');
      expect(fitterCallCount).toBe(0);
    });

    it('fails closed on materialization failure', async () => {
      await setupReadyCampaign(tempRoot);
      const registrationInput = makeRegistrationInput({
        candidateRecipe: makeRecipe({ modelFamilyId: 'UNKNOWN_MODEL' }),
      });
      const registrationResult = await registerMLBInnerDevelopmentCampaignCandidate(tempRoot, registrationInput);
      expect(registrationResult.ok).toBe(true);
      if (!registrationResult.ok) {
        throw new Error('Registration failed');
      }

      let fitterCallCount = 0;
      const fitter: MLBInnerDevelopmentCandidateFoldFitter = () => {
        fitterCallCount += 1;
        throw new Error('Fitter should not be called');
      };

      const input = createOrchestrationInput(tempRoot, {
        candidateRecipeId: registrationInput.candidateRecipe.candidateRecipeId,
        attemptNumber: registrationResult.value.attemptNumber,
        foldFitter: fitter,
      });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('PREPARATION_OR_CANONICAL_FAILURE');
      expect(fitterCallCount).toBe(0);
    });

    it('fails closed on provider failure', async () => {
      await setupReadyCampaign(tempRoot);
      const attemptNumber = await registerSyntheticCandidate(tempRoot);

      let fitterCallCount = 0;
      const fitter: MLBInnerDevelopmentCandidateFoldFitter = () => {
        fitterCallCount += 1;
        throw new Error('Fitter should not be called');
      };

      const provider: MLBInnerDevelopmentVerifiedTrainArtifactProvider = async () =>
        createSyntheticProviderFailure();
      const input = createOrchestrationInput(tempRoot, { attemptNumber, provider, foldFitter: fitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('PREPARATION_OR_CANONICAL_FAILURE');
      expect(fitterCallCount).toBe(0);
    });

    it('fails closed on preparation failure', async () => {
      await setupReadyCampaign(tempRoot);
      const attemptNumber = await registerSyntheticCandidate(tempRoot);

      let fitterCallCount = 0;
      const fitter: MLBInnerDevelopmentCandidateFoldFitter = () => {
        fitterCallCount += 1;
        throw new Error('Fitter should not be called');
      };

      const provider: MLBInnerDevelopmentVerifiedTrainArtifactProvider =
        createProviderWithBadVerifiedSha256();
      const input = createOrchestrationInput(tempRoot, { attemptNumber, provider, foldFitter: fitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('PREPARATION_OR_CANONICAL_FAILURE');
      expect(fitterCallCount).toBe(0);
    });
  });

  describe('claim failure', () => {
    it('fails closed when claim loses race after preparation succeeds', async () => {
      await setupReadyCampaign(tempRoot);
      const attemptNumber = await registerSyntheticCandidate(tempRoot);

      const provenance = {
        verifiedArtifactSha256: 'a'.repeat(64),
        verifiedArtifactByteLength: 1024,
        artifactId: 'artifact-1',
        foldPlanId: 'fold-plan-1',
      };

      const provider: MLBInnerDevelopmentVerifiedTrainArtifactProvider = async () => {
        const claimInput: MLBInnerDevelopmentAttemptClaimInput = {
          repositoryRoot: tempRoot,
          candidateRecipeId: 'synthetic-recipe-1',
          attemptNumber,
          executionProvenance: provenance,
        };
        const preClaim = await claimMLBInnerDevelopmentAttemptForExecution(claimInput);
        expect(preClaim.ok).toBe(true);
        return createSyntheticProviderSuccess();
      };

      let fitterCallCount = 0;
      const fitter: MLBInnerDevelopmentCandidateFoldFitter = () => {
        fitterCallCount += 1;
        throw new Error('Fitter should not be called');
      };

      const input = createOrchestrationInput(tempRoot, { attemptNumber, provider, foldFitter: fitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('CLAIM_FAILURE');
      expect(fitterCallCount).toBe(0);
    });
  });

  describe('eligible end-to-end', () => {
    it('completes eligible candidate through full orchestration', async () => {
      await setupReadyCampaign(tempRoot);
      const attemptNumber = await registerSyntheticCandidate(tempRoot);

      const preparationInput = createPreparationInput();
      const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
      expect(preparationResult.ok).toBe(true);
      if (!preparationResult.ok) {
        throw new Error('Preparation failed');
      }

      const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
      for (const fold of preparationResult.value.folds.folds) {
        predictionsByFold.set(
          fold.foldId,
          createPredictions(fold.innerValidationRows, (_, targetValue) => targetValue, fold.foldId, 'synthetic-recipe-1'),
        );
      }

      let fitterCallCount = 0;
      const foldFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
        fitterCallCount += 1;
        return createFakeFoldFitter(predictionsByFold)(input);
      };

      const provider: MLBInnerDevelopmentVerifiedTrainArtifactProvider = async () =>
        createSyntheticProviderSuccess();
      const input = createOrchestrationInput(tempRoot, { attemptNumber, provider, foldFitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(true);
      if (result.ok === true) {
        expect(result.candidateRecipeId).toBe('synthetic-recipe-1');
        expect(result.attemptNumber).toBe(attemptNumber);
        expect(result.finalTerminalStatus).toBe('COMPLETED_INNER_ELIGIBLE');
        if (result.executionResult.ok) {
          expect(result.executionResult.value.gate.eligibility).toBe('INNER_ELIGIBLE');
        }
      }
      expect(fitterCallCount).toBe(4);

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(true);
      if (!inspection.ok) {
        throw new Error('Post-orchestration inspection failed');
      }
      const attempt = inspection.ledger.attempts.find(
        (a) => a.candidateRecipeId === 'synthetic-recipe-1' && a.attemptNumber === attemptNumber,
      );
      expect(attempt?.status).toBe('COMPLETED_INNER_ELIGIBLE');
      if (!attempt) {
        throw new Error('Attempt not found');
      }
      if ('executionProvenance' in attempt && attempt.executionProvenance) {
        expect(attempt.executionProvenance.verifiedArtifactSha256).toBe(
          MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
        );
        expect(attempt.executionProvenance.verifiedArtifactByteLength).toBe(
          MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
        );
        expect(attempt.executionProvenance.artifactId).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID);
        expect(attempt.executionProvenance.foldPlanId).toBe(MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FOLD_PLAN_ID);
      }
    });
  });

  describe('rejected end-to-end', () => {
    it('completes rejected candidate through full orchestration', async () => {
      await setupReadyCampaign(tempRoot);
      const attemptNumber = await registerSyntheticCandidate(tempRoot);

      const preparationInput = createPreparationInput();
      const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
      expect(preparationResult.ok).toBe(true);
      if (!preparationResult.ok) {
        throw new Error('Preparation failed');
      }

      const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
      for (const fold of preparationResult.value.folds.folds) {
        predictionsByFold.set(
          fold.foldId,
          createPredictions(fold.innerValidationRows, () => 0.5, fold.foldId, 'synthetic-recipe-1'),
        );
      }

      let fitterCallCount = 0;
      const foldFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
        fitterCallCount += 1;
        return createFakeFoldFitter(predictionsByFold)(input);
      };

      const provider: MLBInnerDevelopmentVerifiedTrainArtifactProvider = async () =>
        createSyntheticProviderSuccess();
      const input = createOrchestrationInput(tempRoot, { attemptNumber, provider, foldFitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(true);
      if (result.ok === true) {
        expect(result.finalTerminalStatus).toBe('COMPLETED_INNER_REJECTED');
        if (result.executionResult.ok) {
          expect(result.executionResult.value.gate.eligibility).toBe('INNER_REJECTED');
        }
      }
      expect(fitterCallCount).toBe(4);
    });
  });

  describe('failed execution end-to-end', () => {
    it('finalizes failed candidate when fold fitter short-circuits at FOLD_2', async () => {
      await setupReadyCampaign(tempRoot);
      const attemptNumber = await registerSyntheticCandidate(tempRoot);

      const preparationInput = createPreparationInput();
      const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
      expect(preparationResult.ok).toBe(true);
      if (!preparationResult.ok) {
        throw new Error('Preparation failed');
      }

      let fitterCallCount = 0;
      const foldFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
        fitterCallCount += 1;
        if (input.foldId === 'FOLD_2') {
          return {
            ok: false,
            issues: [
              {
                code: 'MODEL_FIT_FAILURE',
                path: '$.trainRows',
                message: 'Synthetic fold 2 failure',
              },
            ],
            lowLevelFitCount: 1,
          };
        }
        const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
        predictionsByFold.set(
          'FOLD_1',
          createPredictions(preparationResult.value.folds.folds[0].innerValidationRows, () => 0.5, 'FOLD_1', 'synthetic-recipe-1'),
        );
        return createFakeFoldFitter(predictionsByFold)(input);
      };

      const provider: MLBInnerDevelopmentVerifiedTrainArtifactProvider = async () =>
        createSyntheticProviderSuccess();
      const input = createOrchestrationInput(tempRoot, { attemptNumber, provider, foldFitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(true);
      if (result.ok === true) {
        expect(result.finalTerminalStatus).toBe('FAILED');
        const executionResult = result.executionResult;
        expect(executionResult.ok).toBe(false);
        if (!executionResult.ok) {
          expect(executionResult.failedFoldId).toBe('FOLD_2');
          expect(executionResult.lowLevelFitCount).toBe(1);
        }
      }
      expect(fitterCallCount).toBe(2);

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(true);
      if (!inspection.ok) {
        throw new Error('Post-orchestration inspection failed');
      }
      const attempt = inspection.ledger.attempts.find(
        (a) => a.candidateRecipeId === 'synthetic-recipe-1' && a.attemptNumber === attemptNumber,
      );
      expect(attempt?.status).toBe('FAILED');
    });
  });

  describe('unexpected execution exception', () => {
    it('returns running durable state on unexpected fitter throw', async () => {
      await setupReadyCampaign(tempRoot);
      const attemptNumber = await registerSyntheticCandidate(tempRoot);

      const provider: MLBInnerDevelopmentVerifiedTrainArtifactProvider = async () =>
        createSyntheticProviderSuccess();
      const foldFitter: MLBInnerDevelopmentCandidateFoldFitter = () => {
        throw new Error('Unexpected fitter throw');
      };

      const input = createOrchestrationInput(tempRoot, { attemptNumber, provider, foldFitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('UNEXPECTED_EXECUTION_EXCEPTION_WITH_RUNNING_DURABLE');

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(true);
      if (!inspection.ok) {
        throw new Error('Post-orchestration inspection failed');
      }
      const attempt = inspection.ledger.attempts.find(
        (a) => a.candidateRecipeId === 'synthetic-recipe-1' && a.attemptNumber === attemptNumber,
      );
      expect(attempt?.status).toBe('RUNNING');
    });
  });

  describe('finalize failure', () => {
    it('returns finalize failure when terminal persistence breaks', async () => {
      await setupReadyCampaign(tempRoot);
      const attemptNumber = await registerSyntheticCandidate(tempRoot);

      const preparationInput = createPreparationInput();
      const preparationResult = prepareMLBInnerDevelopmentCandidateExecution(preparationInput);
      expect(preparationResult.ok).toBe(true);
      if (!preparationResult.ok) {
        throw new Error('Preparation failed');
      }

      const predictionsByFold = new Map<string, readonly MLBInnerCandidatePredictionRecord[]>();
      for (const fold of preparationResult.value.folds.folds) {
        predictionsByFold.set(
          fold.foldId,
          createPredictions(fold.innerValidationRows, (_, targetValue) => targetValue, fold.foldId, 'synthetic-recipe-1'),
        );
      }

      const ledgerDir = path.join(tempRoot, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_DIRECTORY);
      const tempPath = path.join(ledgerDir, MLB_INNER_DEVELOPMENT_CAMPAIGN_LEDGER_FILENAME + '.tmp');

      let fitterCallCount = 0;
      const foldFitter: MLBInnerDevelopmentCandidateFoldFitter = (input) => {
        fitterCallCount += 1;
        if (fitterCallCount === 4) {
          fs.writeFile(tempPath, 'FORENSIC_STALE_TEMP\n', 'utf-8');
        }
        return createFakeFoldFitter(predictionsByFold)(input);
      };

      const provider: MLBInnerDevelopmentVerifiedTrainArtifactProvider = async () =>
        createSyntheticProviderSuccess();
      const input = createOrchestrationInput(tempRoot, { attemptNumber, provider, foldFitter });
      const result = await orchestrateMLBInnerDevelopmentCandidateExecution(input);

      expect(result.ok).toBe(false);
      expect(result.state).toBe('FINALIZE_FAILURE');
      expect(fitterCallCount).toBe(4);

      await fs.rm(tempPath, { recursive: true, force: true });

      const inspection = await inspectMLBInnerDevelopmentCampaignStateAssumingLockHeld(tempRoot);
      expect(inspection.ok).toBe(true);
      if (!inspection.ok) {
        throw new Error('Post-orchestration inspection failed');
      }
      const attempt = inspection.ledger.attempts.find(
        (a) => a.candidateRecipeId === 'synthetic-recipe-1' && a.attemptNumber === attemptNumber,
      );
      expect(attempt?.status).toBe('RUNNING');
    });
  });
});
