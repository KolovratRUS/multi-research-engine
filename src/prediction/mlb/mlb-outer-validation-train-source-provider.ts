import { readFile } from 'node:fs/promises';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH,
} from './mlb-inner-development-train-artifact-runtime-provenance';
import {
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
  MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
  MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
  MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
} from './mlb-outer-validation-promotion-contract';
import {
  loadMLBInnerDevelopmentTrainArtifact,
  type MLBInnerDevelopmentTrainArtifactReader,
  type MLBInnerDevelopmentTrainArtifactProviderIssue,
  type MLBInnerDevelopmentTrainArtifactProviderResult,
} from './mlb-inner-development-train-artifact-provider';
import {
  MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION,
  type MLBOuterValidationTrainSource,
  validateMLBOuterValidationTrainSource,
} from './mlb-outer-validation-train-source-contract';
import type { MLBInnerDevelopmentTrainArtifact } from './mlb-inner-development-train-artifact';

export type MLBOuterValidationTrainSourceProviderIssue = Readonly<{
  code:
    | 'INNER_ARTIFACT_LOAD_FAILED'
    | 'INNER_ARTIFACT_INVALID'
    | 'ARTIFACT_HASH_MISMATCH'
    | 'ARTIFACT_BYTE_LENGTH_MISMATCH'
    | 'SOURCE_IDENTITY_MISMATCH'
    | 'OUTER_BINDING_MISMATCH'
    | 'TRAIN_ROW_COUNT_MISMATCH'
    | 'TRAIN_SPLIT_VIOLATION'
    | 'SOURCE_CONTRACT_INVALID';
  path: string;
  message: string;
}>;

export type MLBOuterValidationTrainSourceProviderResult =
  | Readonly<{
      ok: true;
      source: MLBOuterValidationTrainSource;
    }>
  | Readonly<{
      ok: false;
      issues: readonly MLBOuterValidationTrainSourceProviderIssue[];
    }>;

const HEXADECIMAL_PATTERN = /^[0-9a-f]{64}$/;

function pushProviderIssue(
  issues: MLBOuterValidationTrainSourceProviderIssue[],
  code: MLBOuterValidationTrainSourceProviderIssue['code'],
  path: string,
  message: string,
): void {
  issues.push({ code, path, message } as MLBOuterValidationTrainSourceProviderIssue);
}

function sortProviderIssues(
  issues: MLBOuterValidationTrainSourceProviderIssue[],
): readonly MLBOuterValidationTrainSourceProviderIssue[] {
  return issues.sort((a, b) => {
    const codeCompare = a.code.localeCompare(b.code);
    if (codeCompare !== 0) return codeCompare;
    return a.path.localeCompare(b.path);
  });
}

function mapInnerIssue(
  issue: MLBInnerDevelopmentTrainArtifactProviderIssue,
): MLBOuterValidationTrainSourceProviderIssue {
  if (issue.code === 'TRAIN_ARTIFACT_LOAD_FAILED') {
    return {
      code: 'INNER_ARTIFACT_LOAD_FAILED',
      path: issue.path,
      message: issue.message,
    } as MLBOuterValidationTrainSourceProviderIssue;
  }
  if (issue.code === 'TRAIN_ARTIFACT_HASH_MISMATCH') {
    return {
      code: 'ARTIFACT_HASH_MISMATCH',
      path: issue.path,
      message: issue.message,
    } as MLBOuterValidationTrainSourceProviderIssue;
  }
  return {
    code: 'INNER_ARTIFACT_INVALID',
    path: issue.path,
    message: issue.message,
  } as MLBOuterValidationTrainSourceProviderIssue;
}

function buildDualProvenanceSource(
  artifact: MLBInnerDevelopmentTrainArtifact,
): MLBOuterValidationTrainSource {
  const outerBinding = Object.freeze({
    datasetId: MLB_OUTER_VALIDATION_PROMOTION_DATASET_ID,
    datasetSha256: MLB_OUTER_VALIDATION_PROMOTION_DATASET_SHA256,
    matrixId: MLB_OUTER_VALIDATION_PROMOTION_MATRIX_ID,
    manifestId: MLB_OUTER_VALIDATION_PROMOTION_MANIFEST_ID,
    trainingRowCount: 301,
  }) as MLBOuterValidationTrainSource['outerBinding'];

  return Object.freeze({
    contractVersion: MLB_OUTER_VALIDATION_TRAIN_SOURCE_CONTRACT_VERSION,
    verifiedArtifact: artifact,
    verifiedArtifactSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    verifiedArtifactByteLength: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH,
    outerBinding,
  }) as MLBOuterValidationTrainSource;
}

export async function loadMLBOuterValidationTrainSource(
  repositoryRoot: string,
  reader?: MLBInnerDevelopmentTrainArtifactReader,
): Promise<MLBOuterValidationTrainSourceProviderResult> {
  const sourcePath = `${repositoryRoot.replace(/\/+$/, '')}/${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_REPOSITORY_PATH}`;

  const innerReader: MLBInnerDevelopmentTrainArtifactReader =
    reader ??
    (async (path: string): Promise<Uint8Array> => {
      const buffer = await readFile(path);
      return buffer;
    });

  const innerResult = await loadMLBInnerDevelopmentTrainArtifact(
    {
      sourcePath,
      expectedArtifactSha256: MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_SHA256,
    },
    innerReader,
  );

  if (!innerResult.ok) {
    return {
      ok: false,
      issues: sortProviderIssues(innerResult.issues.map(mapInnerIssue)),
    };
  }

  if (innerResult.byteLength !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH) {
    return {
      ok: false,
      issues: sortProviderIssues([
        {
          code: 'ARTIFACT_BYTE_LENGTH_MISMATCH',
          path: '$',
          message: `Loaded artifact byte length ${innerResult.byteLength} does not match expected ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_EXPECTED_BYTE_LENGTH}`,
        } as MLBOuterValidationTrainSourceProviderIssue,
      ]),
    };
  }

  const source = buildDualProvenanceSource(innerResult.artifact);
  const validationResult = validateMLBOuterValidationTrainSource(source);
  if (!validationResult.ok) {
    return {
      ok: false,
      issues: sortProviderIssues(
        validationResult.issues.map((issue) => ({
          code: 'SOURCE_CONTRACT_INVALID' as MLBOuterValidationTrainSourceProviderIssue['code'],
          path: issue.path,
          message: `${issue.code}: ${issue.message}`,
        })),
      ),
    };
  }

  return { ok: true, source: validationResult.value };
}
