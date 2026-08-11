import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  buildMLBRealHistoricalTrainingMatrixV1,
} from '@/prediction/mlb/mlb-real-historical-training-matrix-v1';

interface ParsedArgs {
  readonly input: string;
  readonly output: string;
}

export function parseMLBRealHistoricalTrainingMatrixCliArgs(
  argv: readonly string[],
): ParsedArgs {
  let input = '';
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
      case 'input':
        input = value;
        break;
      case 'output':
        output = value;
        break;
      default:
        throw new Error(`Unknown flag: --${flag}`);
    }
  }

  if (!input) throw new Error('Missing --input');
  if (!output) throw new Error('Missing --output');
  if (input.trim().length === 0) {
    throw new Error('Invalid --input: path required');
  }
  if (output.trim().length === 0) {
    throw new Error('Invalid --output: path required');
  }

  return {
    input: input.trim(),
    output: output.trim(),
  };
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

export async function main(): Promise<void> {
  const args = parseMLBRealHistoricalTrainingMatrixCliArgs(process.argv);

  const raw = await fs.readFile(args.input, 'utf8');
  const dataset = JSON.parse(raw) as unknown;

  const result = buildMLBRealHistoricalTrainingMatrixV1(dataset);
  if (!result.ok) {
    for (const issue of result.issues) {
      console.error(`${issue.code}: ${issue.message}`);
    }
    process.exit(1);
  }

  await writeOutputAtomically(args.output, result.value);
  console.log('MLB real historical training matrix materialized');
  console.log(`output: ${path.resolve(args.output)}`);
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
