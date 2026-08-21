import {
  type MLBInnerMaterializedCandidate,
} from './mlb-inner-development-candidate-materialization';
import {
  validateMLBInnerDevelopmentTrainArtifact,
  type MLBInnerDevelopmentTrainArtifact,
  type MLBInnerDevelopmentTrainArtifactIssue,
} from './mlb-inner-development-train-artifact';
import {
  type MLBInnerDevelopmentTrainArtifactProviderResult,
} from './mlb-inner-development-train-artifact-provider';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
} from './mlb-inner-development-train-artifact-runtime-provenance';
import {
  validateMLBTrainOnlyInnerRowCollection,
  type MLBTrainOnlyInnerRowCollection,
  type MLBTrainOnlyInnerRowCollectionIssue,
  buildMLBTrainOnlyInnerValidationFolds,
  type MLBTrainOnlyInnerValidationFolds,
  type MLBFoldMaterialization,
  buildMLBInnerDevelopmentReferenceFacts,
  type MLBInnerDevelopmentReferenceFacts,
  evaluateMLBInnerFoldMetrics,
  type MLBInnerFoldMetricResult,
  evaluateMLBTrainOnlyInnerCandidate,
  type MLBInnerAggregateResult,
  evaluateMLBTrainOnlyInnerCandidateGate,
  type MLBInnerCandidateGateResult,
  MLB_TRAIN_ONLY_INNER_ROW_COLLECTION_CONTRACT_VERSION,
} from './mlb-train-only-inner-development-evaluator';
import {
  MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN,
  type MLBTrainOnlyInnerFoldPlan,
} from './mlb-train-only-inner-fold-plan';
import {
  type MLBInnerDevelopmentCampaignProvenance,
} from './mlb-inner-development-campaign-provenance';
import {
  type MLBModelTrainingConfiguration,
} from './mlb-model-training-plan-contract';
import { fitMLBInnerDevelopmentFold } from './mlb-inner-development-fold-fitter';

export type MLBInnerDevelopmentTrainArtifactProviderSuccess = Extract<
  MLBInnerDevelopmentTrainArtifactProviderResult,
  { ok: true }
>;

export type MLBInnerDevelopmentCandidatePreparationIssue = Readonly<{
  code:
    | 'VERIFIED_ARTIFACT_SHA_MISMATCH'
    | 'VERIFIED_ARTIFACT_BYTE_LENGTH_MISMATCH'
    | 'ARTIFACT_INVARIANT_VIOLATION'
    | 'RECIPE_ARTIFACT_POLICY_MISMATCH'
    | 'FOLD_PREPARATION_FAILURE';
  path: string;
  message: string;
}>;

export type MLBPreparedInnerDevelopmentCandidateExecution = Readonly<{
  candidateRecipeId: string;
  configuration: MLBModelTrainingConfiguration;
  provenance: MLBInnerDevelopmentCampaignProvenance;
  verifiedArtifactSha256: string;
  verifiedArtifactByteLength: number;
  artifactId: string;
  sourceDatasetId: string;
  sourceMatrixId: string;
  manifestId: string;
  featurePolicyId: string;
  preprocessingPolicyId: string;
  foldPlanId: string;
  folds: MLBTrainOnlyInnerValidationFolds;
}>;

export type MLBInnerDevelopmentCandidatePreparationResult =
  | Readonly<{
      ok: true;
      value: MLBPreparedInnerDevelopmentCandidateExecution;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBInnerDevelopmentCandidatePreparationIssue[];
    }>;

export type MLBInnerDevelopmentCandidatePreparationInput = Readonly<{
  materializedCandidate: MLBInnerMaterializedCandidate;
  verifiedTrainArtifact: MLBInnerDevelopmentTrainArtifactProviderSuccess;
}>;

export type MLBInnerDevelopmentCandidateExecutionIssue = Readonly<{
  code:
    | 'FOLD_FIT_FAILURE'
    | 'FOLD_FIT_RESULT_INVARIANT_VIOLATION'
    | 'FOLD_METRIC_FAILURE'
    | 'AGGREGATION_FAILURE'
    | 'GATE_FAILURE';
  path: string;
  message: string;
}>;

export type MLBInnerDevelopmentCandidateExecutionSuccess = Readonly<{
  ok: true;
  candidateRecipeId: string;
  verifiedArtifactSha256: string;
  verifiedArtifactByteLength: number;
  artifactId: string;
  foldPlanId: string;
  foldResults: readonly MLBInnerFoldMetricResult[];
  aggregate: MLBInnerAggregateResult;
  gate: MLBInnerCandidateGateResult;
  lowLevelFitCount: number;
}>;

export type MLBInnerDevelopmentCandidateExecutionResult =
  | Readonly<{
      ok: true;
      value: MLBInnerDevelopmentCandidateExecutionSuccess;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBInnerDevelopmentCandidateExecutionIssue[];
      lowLevelFitCount: number;
      failedFoldId?: string;
    }>;

export type MLBInnerDevelopmentCandidateExecutionInput = Readonly<{
  preparedExecution: MLBPreparedInnerDevelopmentCandidateExecution;
  foldFitter: MLBInnerDevelopmentCandidateFoldFitter;
}>;

export type MLBInnerDevelopmentCandidateFoldFitter = typeof fitMLBInnerDevelopmentFold;

type MLBInnerDevelopmentReferenceProvenance = Readonly<{
  matrixId: string;
  manifestId: string;
  datasetId: string;
}>;

export function prepareMLBInnerDevelopmentCandidateExecution(
  input: MLBInnerDevelopmentCandidatePreparationInput,
): MLBInnerDevelopmentCandidatePreparationResult {
  const issues: MLBInnerDevelopmentCandidatePreparationIssue[] = [];

  if (
    input.verifiedTrainArtifact.verifiedSha256 !==
    MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256
  ) {
    issues.push({
      code: 'VERIFIED_ARTIFACT_SHA_MISMATCH',
      path: '$.verifiedTrainArtifact.verifiedSha256',
      message: 'Verified artifact SHA-256 does not match frozen trust anchor',
    });
  }

  if (
    input.verifiedTrainArtifact.byteLength !==
    MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH
  ) {
    issues.push({
      code: 'VERIFIED_ARTIFACT_BYTE_LENGTH_MISMATCH',
      path: '$.verifiedTrainArtifact.byteLength',
      message: 'Verified artifact byte length does not match frozen trust anchor',
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  const { materializedCandidate, verifiedTrainArtifact } = input;
  const artifact = verifiedTrainArtifact.artifact;

  const artifactValidation = validateMLBInnerDevelopmentTrainArtifact(artifact);
  if (!artifactValidation.ok) {
    const subIssues: MLBInnerDevelopmentCandidatePreparationIssue[] =
      artifactValidation.issues.map((issue) => ({
        code: 'ARTIFACT_INVARIANT_VIOLATION',
        path: issue.path,
        message: `${issue.code}: ${issue.message}`,
      }));
    return { ok: false, issues: subIssues };
  }

  const validatedArtifact = artifactValidation.value;

  const rowCollectionValidation = validateMLBTrainOnlyInnerRowCollection(
    validatedArtifact.rowCollection,
  );
  if (!rowCollectionValidation.ok) {
    const subIssues: MLBInnerDevelopmentCandidatePreparationIssue[] =
      rowCollectionValidation.issues.map((issue) => ({
        code: 'ARTIFACT_INVARIANT_VIOLATION',
        path: issue.path,
        message: `${issue.code}: ${issue.message}`,
      }));
    return { ok: false, issues: subIssues };
  }

  const provenance = materializedCandidate.provenance;
  const crossIssues: MLBInnerDevelopmentCandidatePreparationIssue[] = [];

  if (validatedArtifact.featureManifestId !== provenance.manifestId) {
    crossIssues.push({
      code: 'RECIPE_ARTIFACT_POLICY_MISMATCH',
      path: '$.provenance.manifestId',
      message: `Candidate manifestId ${provenance.manifestId} does not match artifact featureManifestId ${validatedArtifact.featureManifestId}`,
    });
  }

  if (validatedArtifact.featurePolicyId !== provenance.featurePolicyId) {
    crossIssues.push({
      code: 'RECIPE_ARTIFACT_POLICY_MISMATCH',
      path: '$.provenance.featurePolicyId',
      message: `Candidate featurePolicyId ${provenance.featurePolicyId} does not match artifact featurePolicyId ${validatedArtifact.featurePolicyId}`,
    });
  }

  if (validatedArtifact.preprocessingPolicyId !== provenance.preprocessingPolicyId) {
    crossIssues.push({
      code: 'RECIPE_ARTIFACT_POLICY_MISMATCH',
      path: '$.provenance.preprocessingPolicyId',
      message: `Candidate preprocessingPolicyId ${provenance.preprocessingPolicyId} does not match artifact preprocessingPolicyId ${validatedArtifact.preprocessingPolicyId}`,
    });
  }

  if (materializedCandidate.configuration.algorithm !== 'L2_LOGISTIC_REGRESSION_BINARY_V1') {
    crossIssues.push({
      code: 'RECIPE_ARTIFACT_POLICY_MISMATCH',
      path: '$.configuration.algorithm',
      message: `Candidate algorithm ${materializedCandidate.configuration.algorithm} is not the canonical L2_LOGISTIC_REGRESSION_BINARY_V1`,
    });
  }

  if (validatedArtifact.foldPlanId !== MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN.contractVersion) {
    crossIssues.push({
      code: 'RECIPE_ARTIFACT_POLICY_MISMATCH',
      path: '$.artifact.foldPlanId',
      message: `Artifact foldPlanId ${validatedArtifact.foldPlanId} does not match canonical fold plan ${MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN.contractVersion}`,
    });
  }

  if (validatedArtifact.rowCount !== 301) {
    crossIssues.push({
      code: 'RECIPE_ARTIFACT_POLICY_MISMATCH',
      path: '$.artifact.rowCount',
      message: `Artifact rowCount ${validatedArtifact.rowCount} does not match expected 301`,
    });
  }

  if (validatedArtifact.firstOfficialDate !== '2026-04-01') {
    crossIssues.push({
      code: 'RECIPE_ARTIFACT_POLICY_MISMATCH',
      path: '$.artifact.firstOfficialDate',
      message: `Artifact firstOfficialDate ${validatedArtifact.firstOfficialDate} does not match expected 2026-04-01`,
    });
  }

  if (validatedArtifact.lastOfficialDate !== '2026-04-23') {
    crossIssues.push({
      code: 'RECIPE_ARTIFACT_POLICY_MISMATCH',
      path: '$.artifact.lastOfficialDate',
      message: `Artifact lastOfficialDate ${validatedArtifact.lastOfficialDate} does not match expected 2026-04-23`,
    });
  }

  if (crossIssues.length > 0) {
    return { ok: false, issues: crossIssues };
  }

  let folds: MLBTrainOnlyInnerValidationFolds;
  try {
    folds = buildMLBTrainOnlyInnerValidationFolds(
      rowCollectionValidation.value,
      MLB_CANONICAL_TRAIN_ONLY_INNER_FOLD_PLAN,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown fold preparation failure';
    return {
      ok: false,
      issues: [
        {
          code: 'FOLD_PREPARATION_FAILURE',
          path: '$.folds',
          message,
        },
      ],
    };
  }

  const sourceMatrixId = `${validatedArtifact.sourceDatasetId}::${validatedArtifact.featureManifestId}`;

  const result: MLBPreparedInnerDevelopmentCandidateExecution = {
    candidateRecipeId: materializedCandidate.candidateRecipeId,
    configuration: materializedCandidate.configuration,
    provenance: materializedCandidate.provenance,
    verifiedArtifactSha256: verifiedTrainArtifact.verifiedSha256,
    verifiedArtifactByteLength: verifiedTrainArtifact.byteLength,
    artifactId: validatedArtifact.artifactId,
    sourceDatasetId: validatedArtifact.sourceDatasetId,
    sourceMatrixId,
    manifestId: validatedArtifact.featureManifestId,
    featurePolicyId: validatedArtifact.featurePolicyId,
    preprocessingPolicyId: validatedArtifact.preprocessingPolicyId,
    foldPlanId: validatedArtifact.foldPlanId,
    folds,
  };

  return { ok: true, value: Object.freeze(result) };
}

export function executeMLBInnerDevelopmentCandidate(
  input: MLBInnerDevelopmentCandidateExecutionInput,
): MLBInnerDevelopmentCandidateExecutionResult {
  const { preparedExecution, foldFitter } = input;
  const prepared = preparedExecution;

  const foldResults: MLBInnerFoldMetricResult[] = [];
  let cumulativeLowLevelFitCount = 0;

  for (const fold of prepared.folds.folds) {
    const fitOutcome = foldFitter({
      configuration: prepared.configuration,
      trainRows: fold.innerTrainRows,
      validationRows: fold.innerValidationRows,
      foldId: fold.foldId,
      candidateRecipeId: prepared.candidateRecipeId,
    });

    if (!fitOutcome.ok) {
      return {
        ok: false,
        issues: [
          {
            code: 'FOLD_FIT_FAILURE',
            path: `$.folds.${fold.foldId}`,
            message: `Fold ${fold.foldId} fitter failed: ${fitOutcome.issues.map((issue) => issue.message).join(', ')}`,
          },
        ],
        lowLevelFitCount: cumulativeLowLevelFitCount,
        failedFoldId: fold.foldId,
      };
    }

    cumulativeLowLevelFitCount += fitOutcome.value.lowLevelFitCount;

    const fitSuccess = fitOutcome.value;

    if (fitSuccess.foldId !== fold.foldId) {
      return {
        ok: false,
        issues: [
          {
            code: 'FOLD_FIT_RESULT_INVARIANT_VIOLATION',
            path: `$.folds.${fold.foldId}.foldId`,
            message: `Fitter returned foldId ${fitSuccess.foldId}, expected ${fold.foldId}`,
          },
        ],
        lowLevelFitCount: cumulativeLowLevelFitCount,
        failedFoldId: fold.foldId,
      };
    }

    if (fitSuccess.candidateRecipeId !== prepared.candidateRecipeId) {
      return {
        ok: false,
        issues: [
          {
            code: 'FOLD_FIT_RESULT_INVARIANT_VIOLATION',
            path: `$.folds.${fold.foldId}.candidateRecipeId`,
            message: `Fitter returned candidateRecipeId ${fitSuccess.candidateRecipeId}, expected ${prepared.candidateRecipeId}`,
          },
        ],
        lowLevelFitCount: cumulativeLowLevelFitCount,
        failedFoldId: fold.foldId,
      };
    }

    if (fitSuccess.predictions.length !== fold.validationRowCount) {
      return {
        ok: false,
        issues: [
          {
            code: 'FOLD_FIT_RESULT_INVARIANT_VIOLATION',
            path: `$.folds.${fold.foldId}.predictions`,
            message: `Fitter returned ${fitSuccess.predictions.length} predictions, expected ${fold.validationRowCount}`,
          },
        ],
        lowLevelFitCount: cumulativeLowLevelFitCount,
        failedFoldId: fold.foldId,
      };
    }

    const expectedExampleIds = new Set(fold.innerValidationRows.map((r) => r.exampleId));
    const seenExampleIds = new Set<string>();
    for (let i = 0; i < fitSuccess.predictions.length; i++) {
      const prediction = fitSuccess.predictions[i];
      if (!expectedExampleIds.has(prediction.exampleId)) {
        return {
          ok: false,
          issues: [
            {
              code: 'FOLD_FIT_RESULT_INVARIANT_VIOLATION',
              path: `$.folds.${fold.foldId}.predictions[${i}].exampleId`,
              message: `Prediction exampleId ${prediction.exampleId} not found in fold innerValidationRows`,
            },
          ],
          lowLevelFitCount: cumulativeLowLevelFitCount,
          failedFoldId: fold.foldId,
        };
      }
      if (seenExampleIds.has(prediction.exampleId)) {
        return {
          ok: false,
          issues: [
            {
              code: 'FOLD_FIT_RESULT_INVARIANT_VIOLATION',
              path: `$.folds.${fold.foldId}.predictions`,
              message: `Duplicate prediction exampleId ${prediction.exampleId}`,
            },
          ],
          lowLevelFitCount: cumulativeLowLevelFitCount,
          failedFoldId: fold.foldId,
        };
      }
      if (prediction.exampleId !== fold.innerValidationRows[i].exampleId) {
        return {
          ok: false,
          issues: [
            {
              code: 'FOLD_FIT_RESULT_INVARIANT_VIOLATION',
              path: `$.folds.${fold.foldId}.predictions[${i}].exampleId`,
              message: `Prediction exampleId ${prediction.exampleId} does not align with validation row exampleId ${fold.innerValidationRows[i].exampleId} at index ${i}`,
            },
          ],
          lowLevelFitCount: cumulativeLowLevelFitCount,
          failedFoldId: fold.foldId,
        };
      }
      seenExampleIds.add(prediction.exampleId);
    }

    if (
      !Number.isInteger(fitSuccess.lowLevelFitCount) ||
      fitSuccess.lowLevelFitCount < 0
    ) {
      return {
        ok: false,
        issues: [
          {
            code: 'FOLD_FIT_RESULT_INVARIANT_VIOLATION',
            path: `$.folds.${fold.foldId}.lowLevelFitCount`,
            message: `Invalid lowLevelFitCount ${fitSuccess.lowLevelFitCount}`,
          },
        ],
        lowLevelFitCount: cumulativeLowLevelFitCount,
        failedFoldId: fold.foldId,
      };
    }

    const referenceContext: MLBInnerDevelopmentReferenceProvenance = {
      matrixId: prepared.sourceMatrixId,
      manifestId: prepared.manifestId,
      datasetId: prepared.sourceDatasetId,
    };

    const referenceOutcome = buildMLBInnerDevelopmentReferenceFacts(fold, referenceContext);
    if (!referenceOutcome.ok) {
      return {
        ok: false,
        issues: [
          {
            code: 'FOLD_METRIC_FAILURE',
            path: `$.folds.${fold.foldId}.reference`,
            message: `Reference facts build failed: ${referenceOutcome.issues.map((issue) => issue.message).join(', ')}`,
          },
        ],
        lowLevelFitCount: cumulativeLowLevelFitCount,
        failedFoldId: fold.foldId,
      };
    }

    const metricOutcome = evaluateMLBInnerFoldMetrics(
      fold,
      fitSuccess.predictions,
      referenceOutcome.value,
      referenceContext,
    );
    if (!metricOutcome.ok) {
      return {
        ok: false,
        issues: [
          {
            code: 'FOLD_METRIC_FAILURE',
            path: `$.folds.${fold.foldId}`,
            message: `Fold metric evaluation failed: ${metricOutcome.issues.map((issue) => issue.message).join(', ')}`,
          },
        ],
        lowLevelFitCount: cumulativeLowLevelFitCount,
        failedFoldId: fold.foldId,
      };
    }

    foldResults.push(metricOutcome.value);
  }

  if (foldResults.length !== 4) {
    return {
      ok: false,
      issues: [
        {
          code: 'AGGREGATION_FAILURE',
          path: '$.foldResults',
          message: `Expected exactly 4 fold results, got ${foldResults.length}`,
        },
      ],
      lowLevelFitCount: cumulativeLowLevelFitCount,
    };
  }

  const aggregateOutcome = evaluateMLBTrainOnlyInnerCandidate(foldResults);
  if (!aggregateOutcome.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'AGGREGATION_FAILURE',
          path: '$.aggregate',
          message: `Aggregate evaluation failed: ${aggregateOutcome.issues.map((issue) => issue.message).join(', ')}`,
        },
      ],
      lowLevelFitCount: cumulativeLowLevelFitCount,
    };
  }

  const gateOutcome = evaluateMLBTrainOnlyInnerCandidateGate(foldResults);
  if (!gateOutcome.ok) {
    return {
      ok: false,
      issues: [
        {
          code: 'GATE_FAILURE',
          path: '$.gate',
          message: `Gate evaluation failed: ${gateOutcome.issues.map((issue) => issue.message).join(', ')}`,
        },
      ],
      lowLevelFitCount: cumulativeLowLevelFitCount,
    };
  }

  const success: MLBInnerDevelopmentCandidateExecutionSuccess = {
    ok: true,
    candidateRecipeId: prepared.candidateRecipeId,
    verifiedArtifactSha256: prepared.verifiedArtifactSha256,
    verifiedArtifactByteLength: prepared.verifiedArtifactByteLength,
    artifactId: prepared.artifactId,
    foldPlanId: prepared.foldPlanId,
    foldResults,
    aggregate: aggregateOutcome.value,
    gate: gateOutcome.value,
    lowLevelFitCount: cumulativeLowLevelFitCount,
  };

  return { ok: true, value: Object.freeze(success) };
}
