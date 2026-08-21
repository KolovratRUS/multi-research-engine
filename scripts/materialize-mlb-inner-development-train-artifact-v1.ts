import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { createMLBHistoricalHttpClient } from '@/lib/backtesting/mlb/live-history/client';
import { createMLBHistoricalCache } from '@/lib/backtesting/mlb/live-history/cache';
import {
  createRealMLBHistoricalMaterializationSourceAdapter,
} from '@/prediction/mlb/mlb-historical-materialization-source-adapter';
import {
  materializeMLBHistoricalDataset,
  type MLBHistoricalMaterializationClock,
} from '@/prediction/mlb/mlb-historical-dataset-materializer';
import {
  MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
} from '@/prediction/mlb/mlb-real-pregame-winner-feature-manifest-v1';
import {
  validateMLBFeatureManifest,
} from '@/prediction/mlb/mlb-feature-vector-contract';
import {
  buildMLBLeakageSafeTrainingMatrix,
  validateMLBTrainingMatrix,
} from '@/prediction/mlb/mlb-training-matrix-contract';
import {
  extractMLBOuterTrainRowsForInnerDevelopment,
} from '@/prediction/mlb/mlb-train-only-inner-development-evaluator';
import {
  validateMLBHistoricalLabelledDataset,
  type MLBHistoricalSplitPolicy,
} from '@/prediction/mlb/mlb-historical-labelled-dataset-contract';
import {
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_FIRST_OFFICIAL_DATE,
  MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_LAST_OFFICIAL_DATE,
  buildMLBInnerDevelopmentTrainArtifact,
  computeMLBInnerDevelopmentTrainArtifactSHA256,
  serializeMLBInnerDevelopmentTrainArtifact,
  validateMLBInnerDevelopmentTrainArtifact,
} from '@/prediction/mlb/mlb-inner-development-train-artifact';

interface ParsedArgs {
  readonly output: string;
}

function parseArgs(argv: readonly string[]): ParsedArgs {
  let output = '';

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const flag = arg.slice(2);
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${flag}`);
    }
    i += 1;

    switch (flag) {
      case 'output':
        output = value;
        break;
      default:
        throw new Error(`Unknown flag: --${flag}`);
    }
  }

  if (!output) {
    throw new Error('Missing --output');
  }

  return { output };
}

function buildTrainOnlySplitPolicy(): MLBHistoricalSplitPolicy {
  return {
    strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1',
    embargoDays: 0,
    train: { startDate: '2026-04-01', endDate: '2026-04-23' },
    validation: { startDate: '2026-04-24', endDate: '2026-04-28' },
    test: { startDate: '2026-04-29', endDate: '2026-05-03' },
  };
}

function deriveDatasetId(
  startDate: string,
  endDate: string,
  cutoffMinutesBeforeStart: number,
): string {
  return `mlb-historical-labelled-dataset-v1-${startDate}-${endDate}-${cutoffMinutesBeforeStart}`;
}

class RealClock implements MLBHistoricalMaterializationClock {
  readonly now: () => Date = () => new Date();
}

async function writeOutputAtomically(
  outputPath: string,
  data: unknown,
): Promise<void> {
  const resolved = path.resolve(outputPath);
  const parent = path.dirname(resolved);
  await fs.mkdir(parent, { recursive: true });
  const tempPath = `${resolved}.${process.pid}.tmp`;
  const content = JSON.stringify(data, null, 2) + '\n';
  await fs.writeFile(tempPath, content, 'utf8');
  await fs.rename(tempPath, resolved);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  const startDate = '2026-04-01';
  const endDate = '2026-04-23';
  const cutoffMinutesBeforeStart = 360;

  const datasetId = deriveDatasetId(
    startDate,
    endDate,
    cutoffMinutesBeforeStart,
  );

  if (datasetId !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID) {
    throw new Error(
      `Derived datasetId ${datasetId} does not match expected ${MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID}`,
    );
  }

  const client = createMLBHistoricalHttpClient();
  const cacheRoot = path.join(os.tmpdir(), 'mlb-historical-cache');
  const cache = createMLBHistoricalCache({ root: cacheRoot, version: 'v1' });
  const sourceAdapter = createRealMLBHistoricalMaterializationSourceAdapter({
    client,
    cache,
    now: () => new Date(),
  });

  const splitPolicy = buildTrainOnlySplitPolicy();

  const materializationResult = await materializeMLBHistoricalDataset({
    startDate,
    endDate,
    cutoffMinutesBeforeStart,
    sourceAdapter,
    clock: new RealClock(),
    datasetId,
    splitPolicy,
  });

  const dataset = materializationResult.dataset;

  const datasetValidation = validateMLBHistoricalLabelledDataset(dataset);
  if (!datasetValidation.ok) {
    throw new Error(
      `Dataset contract invalid: ${datasetValidation.issues.map((i) => i.message).join('; ')}`,
    );
  }

  if (dataset.datasetId !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID) {
    throw new Error(
      `Dataset datasetId mismatch: ${dataset.datasetId}`,
    );
  }

  const manifestValidation = validateMLBFeatureManifest(
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
  );
  if (!manifestValidation.ok) {
    throw new Error(
      `Manifest invalid: ${manifestValidation.issues.map((i) => i.message).join('; ')}`,
    );
  }

  const matrixResult = buildMLBLeakageSafeTrainingMatrix(
    MLB_REAL_PREGAME_WINNER_FEATURE_MANIFEST_V1,
    dataset,
  );
  if (!matrixResult.ok) {
    throw new Error(
      `Matrix build failed: ${matrixResult.issues.map((i) => i.message).join('; ')}`,
    );
  }

  const matrix = matrixResult.value;
  const matrixValidation = validateMLBTrainingMatrix(matrix);
  if (!matrixValidation.ok) {
    throw new Error(
      `Matrix contract invalid: ${matrixValidation.issues.map((i) => i.message).join('; ')}`,
    );
  }

  if (matrix.matrixId !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID) {
    throw new Error(
      `Matrix matrixId mismatch: ${matrix.matrixId}`,
    );
  }

  const collectionResult = extractMLBOuterTrainRowsForInnerDevelopment(matrix);
  if (!collectionResult.ok) {
    throw new Error(
      `Row extraction failed: ${collectionResult.issues.map((i) => i.message).join('; ')}`,
    );
  }

  const rowCollection = collectionResult.value;

  if (rowCollection.rowCount !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ROW_COUNT) {
    throw new Error(
      `Row count mismatch: ${rowCollection.rowCount}`,
    );
  }

  for (const row of rowCollection.rows) {
    if (row.split !== 'TRAIN') {
      throw new Error(
        `Non-TRAIN row found: ${row.exampleId} split=${row.split}`,
      );
    }
  }

  const artifact = buildMLBInnerDevelopmentTrainArtifact(rowCollection);
  const artifactValidation = validateMLBInnerDevelopmentTrainArtifact(artifact);
  if (!artifactValidation.ok) {
    throw new Error(
      `Artifact contract invalid: ${artifactValidation.issues.map((i) => `${i.code}: ${i.message}`).join('; ')}`,
    );
  }

  if (artifact.artifactId !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_ID) {
    throw new Error('Artifact ID mismatch');
  }
  if (artifact.sourceDatasetId !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_DATASET_ID) {
    throw new Error('Artifact sourceDatasetId mismatch');
  }
  if (artifact.rowCollection.matrixId !== MLB_INNER_DEVELOPMENT_TRAIN_ARTIFACT_SOURCE_MATRIX_ID) {
    throw new Error('Row collection matrixId mismatch');
  }

  const serialized = serializeMLBInnerDevelopmentTrainArtifact(artifact);
  const sha256 = computeMLBInnerDevelopmentTrainArtifactSHA256(
    new TextEncoder().encode(serialized),
  );

  await writeOutputAtomically(args.output, artifact);

  console.log(`output: ${path.resolve(args.output)}`);
  console.log(`artifactId: ${artifact.artifactId}`);
  console.log(`datasetId: ${dataset.datasetId}`);
  console.log(`matrixId: ${matrix.matrixId}`);
  console.log(`rowCount: ${artifact.rowCount}`);
  console.log(`firstOfficialDate: ${artifact.firstOfficialDate}`);
  console.log(`lastOfficialDate: ${artifact.lastOfficialDate}`);
  console.log(`byteLength: ${new TextEncoder().encode(serialized).length}`);
  console.log(`sha256: ${sha256}`);
  console.log(`splitSummary: ${artifact.split}`);
}

function isDirectExecution(
  moduleUrl: string,
  argvEntry: string | undefined,
): boolean {
  return argvEntry !== undefined && moduleUrl === pathToFileURL(argvEntry).href;
}

if (isDirectExecution(import.meta.url, process.argv[1])) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
