import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep, win32 } from 'node:path';
import {
  buildScheduleSnapshotFromManualScheduleFile,
  type MLBManualScheduleFile,
  validateMLBManualScheduleFile,
} from '@/prospective/mlb/manual-schedule-file';

const USAGE = 'npm run prospective:mlb:lock-manual-week -- <path-to-json>';
const LOCK_VERSION = 'mlb-manual-week-lock-v1';
const REPOSITORY_ROOT = resolve(__dirname, '..');

type ArgumentError =
  | 'MANUAL_WEEK_LOCK_PATH_REQUIRED'
  | 'MANUAL_WEEK_LOCK_SINGLE_PATH_ONLY'
  | 'MANUAL_WEEK_LOCK_OUTPUT_DIR_REQUIRED'
  | 'MANUAL_WEEK_LOCK_WRITE_FILE_REQUIRED'
  | 'MANUAL_WEEK_LOCK_OUTPUT_DIR_VALUE_REQUIRED'
  | 'MANUAL_WEEK_LOCK_UNKNOWN_ARGUMENT';

interface ParsedArgs {
  readonly path: string;
  readonly writeFile: boolean;
  readonly outputDir: string | null;
  readonly error: ArgumentError | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);
  const positionalPaths: string[] = [];
  let writeFile = false;
  let outputDir: string | null = null;

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];

    if (argument === '--write-file') {
      if (writeFile) {
        return { path: '', writeFile, outputDir, error: 'MANUAL_WEEK_LOCK_UNKNOWN_ARGUMENT' };
      }
      writeFile = true;
      continue;
    }

    if (argument === '--output-dir') {
      if (outputDir !== null) {
        return { path: '', writeFile, outputDir, error: 'MANUAL_WEEK_LOCK_UNKNOWN_ARGUMENT' };
      }
      const value = args[index + 1];
      if (value === undefined || value.startsWith('--')) {
        return { path: '', writeFile, outputDir, error: 'MANUAL_WEEK_LOCK_OUTPUT_DIR_VALUE_REQUIRED' };
      }
      outputDir = value;
      index++;
      continue;
    }

    if (argument.startsWith('-')) {
      return { path: '', writeFile, outputDir, error: 'MANUAL_WEEK_LOCK_UNKNOWN_ARGUMENT' };
    }

    positionalPaths.push(argument);
  }

  if (positionalPaths.length === 0) {
    return { path: '', writeFile, outputDir, error: 'MANUAL_WEEK_LOCK_PATH_REQUIRED' };
  }
  if (positionalPaths.length > 1) {
    return { path: '', writeFile, outputDir, error: 'MANUAL_WEEK_LOCK_SINGLE_PATH_ONLY' };
  }
  if (writeFile && outputDir === null) {
    return { path: '', writeFile, outputDir, error: 'MANUAL_WEEK_LOCK_OUTPUT_DIR_REQUIRED' };
  }
  if (!writeFile && outputDir !== null) {
    return { path: '', writeFile, outputDir, error: 'MANUAL_WEEK_LOCK_WRITE_FILE_REQUIRED' };
  }

  return { path: positionalPaths[0], writeFile, outputDir, error: null };
}

function writeSummary(summary: Record<string, unknown>): void {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function emptyValidationSummary(): Record<string, unknown> {
  return {
    gameCount: 0,
    validationMessageCount: 0,
    validationErrorCount: 0,
    validationWarningCount: 0,
    validationMessages: [],
  };
}

function isPathInsideOrEqual(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);
  return relativePath === '' || (!relativePath.startsWith(`..${sep}`) && relativePath !== '..' && !isAbsolute(relativePath));
}

function resolvePhysicalOutputDirectory(outputDir: string): string | null {
  if (outputDir.trim() === '' || outputDir.includes('\0')) {
    return null;
  }

  try {
    const requestedPath = resolve(outputDir);
    let existingAncestor = requestedPath;
    const missingSegments: string[] = [];

    while (!existsSync(existingAncestor)) {
      const parent = dirname(existingAncestor);
      if (parent === existingAncestor) {
        return null;
      }
      missingSegments.unshift(basename(existingAncestor));
      existingAncestor = parent;
    }

    return resolve(realpathSync(existingAncestor), ...missingSegments);
  } catch {
    return null;
  }
}

function isTrackedFixtureDirectory(outputDir: string): boolean {
  const trackedRoots = [
    resolve(REPOSITORY_ROOT, 'tests'),
    resolve(REPOSITORY_ROOT, 'src', 'fixtures'),
  ];
  return trackedRoots.some((trackedRoot) => isPathInsideOrEqual(trackedRoot, outputDir));
}

function isSafeFilenameComponent(value: string): boolean {
  return value.trim() !== ''
    && value !== '.'
    && !value.includes('..')
    && !value.includes('/')
    && !value.includes('\\')
    && !value.includes('\0');
}

function artifactPathForStdout(finalPath: string, filename: string): string {
  if (!isPathInsideOrEqual(REPOSITORY_ROOT, finalPath)) {
    return filename;
  }
  return relative(REPOSITORY_ROOT, finalPath).split(sep).join('/');
}

function containsAbsolutePath(input: unknown): boolean {
  if (typeof input === 'string') {
    return isAbsolute(input) || win32.isAbsolute(input);
  }
  if (Array.isArray(input)) {
    return input.some(containsAbsolutePath);
  }
  if (typeof input !== 'object' || input === null) {
    return false;
  }
  return Object.values(input as Record<string, unknown>).some(containsAbsolutePath);
}

function writeArtifactWithoutOverwrite(outputDir: string, filename: string, artifact: unknown): string {
  mkdirSync(outputDir, { recursive: true });
  const physicalOutputDir = realpathSync(outputDir);
  const finalPath = resolve(physicalOutputDir, filename);

  if (
    !isPathInsideOrEqual(physicalOutputDir, finalPath)
    || isTrackedFixtureDirectory(physicalOutputDir)
  ) {
    throw Object.assign(new Error('unsafe output path'), { code: 'MANUAL_WEEK_LOCK_OUTPUT_DIR_UNSAFE' });
  }
  if (existsSync(finalPath)) {
    throw Object.assign(new Error('output path exists'), { code: 'MANUAL_WEEK_LOCK_OUTPUT_PATH_EXISTS' });
  }

  const temporaryPath = join(physicalOutputDir, `.${filename}.${process.pid}.tmp`);
  let temporaryCreated = false;
  let finalCreated = false;
  let fileDescriptor: number | null = null;

  try {
    fileDescriptor = openSync(temporaryPath, 'wx');
    temporaryCreated = true;
    writeFileSync(fileDescriptor, `${JSON.stringify(artifact, null, 2)}\n`, 'utf8');
    fsyncSync(fileDescriptor);
    closeSync(fileDescriptor);
    fileDescriptor = null;
    linkSync(temporaryPath, finalPath);
    finalCreated = true;
    unlinkSync(temporaryPath);
    temporaryCreated = false;
    return finalPath;
  } catch (error) {
    if (fileDescriptor !== null) {
      closeSync(fileDescriptor);
    }
    if (temporaryCreated) {
      try {
        unlinkSync(temporaryPath);
      } catch {
        // Preserve the original write error.
      }
    }
    if (finalCreated) {
      try {
        unlinkSync(finalPath);
      } catch {
        // Preserve the original write error.
      }
    }
    throw error;
  }
}

const parsedArgs = parseArgs(process.argv);

if (parsedArgs.error) {
  writeSummary({
    ok: false,
    error: parsedArgs.error,
    usage: USAGE,
    ...emptyValidationSummary(),
  });
  process.exit(1);
}

let data: unknown;
try {
  data = JSON.parse(readFileSync(parsedArgs.path, 'utf8')) as unknown;
} catch {
  writeSummary({
    ok: false,
    error: 'MANUAL_WEEK_LOCK_READ_OR_PARSE_FAILED',
    ...emptyValidationSummary(),
  });
  process.exit(1);
}

const validationMessages = validateMLBManualScheduleFile(data);
const validationErrorCount = validationMessages.filter((message) => message.severity === 'error').length;
const validationWarningCount = validationMessages.filter((message) => message.severity === 'warning').length;
const record = typeof data === 'object' && data !== null ? data as Record<string, unknown> : null;
const games = record && Array.isArray(record.games) ? record.games : [];

const summary: Record<string, unknown> = {
  ok: validationErrorCount === 0,
};

if (record && typeof record.runId === 'string') {
  summary.runId = record.runId;
  summary.lockId = `manual-week-lock:${record.runId}`;
}
if (record && typeof record.sourceMode === 'string') {
  summary.sourceMode = record.sourceMode;
}
if (record && typeof record.weekStart === 'string') {
  summary.weekStart = record.weekStart;
}
if (record && typeof record.weekEnd === 'string') {
  summary.weekEnd = record.weekEnd;
}
if (record && typeof record.createdAt === 'string') {
  summary.lockedAt = record.createdAt;
  summary.snapshotTimestamp = record.createdAt;
}

summary.gameCount = games.length;
summary.validationMessageCount = validationMessages.length;
summary.validationErrorCount = validationErrorCount;
summary.validationWarningCount = validationWarningCount;
summary.validationMessages = validationMessages;

if (validationErrorCount > 0) {
  writeSummary(summary);
  process.exit(1);
}

const input = data as MLBManualScheduleFile;
const lockId = `manual-week-lock:${input.runId}`;
const snapshot = buildScheduleSnapshotFromManualScheduleFile(input);

const lockedSnapshot = {
  lockVersion: LOCK_VERSION,
  runId: input.runId,
  lockId,
  sourceMode: 'manual-schedule',
  weekStart: input.weekStart,
  weekEnd: input.weekEnd,
  lockedAt: input.createdAt,
  snapshot,
  validationMessages,
  warnings: [],
};

if (parsedArgs.writeFile) {
  const filenameComponents = [input.weekStart, input.weekEnd, input.runId];
  const outputDir = parsedArgs.outputDir === null
    ? null
    : resolvePhysicalOutputDirectory(parsedArgs.outputDir);

  if (
    outputDir === null
    || isTrackedFixtureDirectory(outputDir)
    || filenameComponents.some((component) => !isSafeFilenameComponent(component))
    || containsAbsolutePath(lockedSnapshot)
  ) {
    summary.ok = false;
    summary.outputMode = 'file';
    summary.artifactWritten = false;
    summary.error = 'MANUAL_WEEK_LOCK_OUTPUT_DIR_UNSAFE';
    writeSummary(summary);
    process.exit(1);
  }

  const artifactFilename = `${input.weekStart}__${input.weekEnd}__${input.runId}__manual-week-lock-v1.json`;

  try {
    const finalPath = writeArtifactWithoutOverwrite(outputDir, artifactFilename, lockedSnapshot);
    summary.outputMode = 'file';
    summary.artifactWritten = true;
    summary.artifactFilename = artifactFilename;
    summary.artifactPath = artifactPathForStdout(finalPath, artifactFilename);
  } catch (error) {
    const errorCode = error && typeof error === 'object' && 'code' in error
      ? (error as { code?: string }).code
      : undefined;
    summary.ok = false;
    summary.outputMode = 'file';
    summary.artifactWritten = false;
    summary.error = errorCode === 'EEXIST' || errorCode === 'MANUAL_WEEK_LOCK_OUTPUT_PATH_EXISTS'
      ? 'MANUAL_WEEK_LOCK_OUTPUT_PATH_EXISTS'
      : errorCode === 'MANUAL_WEEK_LOCK_OUTPUT_DIR_UNSAFE'
        ? 'MANUAL_WEEK_LOCK_OUTPUT_DIR_UNSAFE'
        : 'MANUAL_WEEK_LOCK_WRITE_FAILED';
    writeSummary(summary);
    process.exit(1);
  }
}

summary.lockedSnapshot = lockedSnapshot;
writeSummary(summary);
