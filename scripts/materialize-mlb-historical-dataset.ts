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

interface ParsedArgs {
  readonly startDate: string;
  readonly endDate: string;
  readonly cutoffMinutesBeforeStart: number;
  readonly output: string;
}

export function parseMLBHistoricalMaterializationCliArgs(
  argv: readonly string[],
): ParsedArgs {
  const seen = new Set<string>();
  let startDate = '';
  let endDate = '';
  let cutoffMinutesBeforeStart: number | null = null;
  let output = '';

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      throw new Error(`Unknown argument: ${arg}`);
    }

    const flag = arg.slice(2);
    if (seen.has(flag)) {
      throw new Error(`Duplicate flag: --${flag}`);
    }
    seen.add(flag);

    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) {
      throw new Error(`Missing value for --${flag}`);
    }
    i += 1;

    switch (flag) {
      case 'start-date':
        startDate = value;
        break;
      case 'end-date':
        endDate = value;
        break;
      case 'cutoff-minutes-before-start': {
        const parsed = Number(value);
        if (!Number.isSafeInteger(parsed) || parsed <= 0) {
          throw new Error('cutoff-minutes-before-start must be a positive integer');
        }
        cutoffMinutesBeforeStart = parsed;
        break;
      }
      case 'output':
        output = value;
        break;
      default:
        throw new Error(`Unknown flag: --${flag}`);
    }
  }

  if (!startDate) throw new Error('Missing --start-date');
  if (!endDate) throw new Error('Missing --end-date');
  if (cutoffMinutesBeforeStart === null) throw new Error('Missing --cutoff-minutes-before-start');
  if (!output) throw new Error('Missing --output');

  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(startDate) || startDate !== startDate.trim()) {
    throw new Error('Invalid --start-date: YYYY-MM-DD required');
  }
  if (!datePattern.test(endDate) || endDate !== endDate.trim()) {
    throw new Error('Invalid --end-date: YYYY-MM-DD required');
  }
  if (startDate > endDate) {
    throw new Error('--start-date must be <= --end-date');
  }
  if (output.trim().length === 0) {
    throw new Error('Invalid --output: path required');
  }

  return {
    startDate: startDate.trim(),
    endDate: endDate.trim(),
    cutoffMinutesBeforeStart,
    output: output.trim(),
  };
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
  const args = parseMLBHistoricalMaterializationCliArgs(process.argv);

  const client = createMLBHistoricalHttpClient();
  const cacheRoot = path.join(os.tmpdir(), 'mlb-historical-cache');
  const cache = createMLBHistoricalCache({ root: cacheRoot, version: 'v1' });
  const sourceAdapter = createRealMLBHistoricalMaterializationSourceAdapter({
    client,
    cache,
    now: () => new Date(),
  });

  const datasetId = deriveDatasetId(
    args.startDate,
    args.endDate,
    args.cutoffMinutesBeforeStart,
  );

  const validationStart = addDays(args.endDate, 1);
  const testStart = addDays(args.endDate, 2);

  const input = {
    startDate: args.startDate,
    endDate: args.endDate,
    cutoffMinutesBeforeStart: args.cutoffMinutesBeforeStart,
    sourceAdapter,
    clock: new RealClock(),
    datasetId,
    splitPolicy: {
      strategy: 'CHRONOLOGICAL_OFFICIAL_DATE_V1' as const,
      embargoDays: 0,
      train: { startDate: args.startDate, endDate: args.startDate },
      validation: { startDate: validationStart, endDate: validationStart },
      test: { startDate: testStart, endDate: testStart },
    },
  };

  const result = await materializeMLBHistoricalDataset(input);

  await writeOutputAtomically(args.output, result.dataset);

  console.log('MLB historical dataset materialized');
  console.log(`datasetId: ${result.dataset.datasetId}`);
  console.log(`games: ${result.summary.materializedExamples}`);
  console.log(`startDate: ${args.startDate}`);
  console.log(`endDate: ${args.endDate}`);
  console.log(`cutoffMinutesBeforeStart: ${args.cutoffMinutesBeforeStart}`);
  console.log(`output: ${path.resolve(args.output)}`);
  console.log(`cache: ${cacheRoot}`);
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
