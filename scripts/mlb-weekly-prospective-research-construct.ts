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
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
  win32,
} from 'node:path';
import {
  constructMLBWeeklyProspectiveResearchPackage,
  type MLBManualWeekLockedSnapshot,
  validateMLBManualWeekLockedSnapshot,
} from '@/prospective/mlb/weekly-research-construction';

const USAGE = 'npm run prospective:mlb:construct-week -- <locked-week-artifact-json>';
const REPOSITORY_ROOT = resolve(__dirname, '..');

type ArgumentError =
  | 'WEEKLY_RESEARCH_CONSTRUCTION_PATH_REQUIRED'
  | 'WEEKLY_RESEARCH_CONSTRUCTION_SINGLE_PATH_ONLY'
  | 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_REQUIRED'
  | 'WEEKLY_RESEARCH_CONSTRUCTION_WRITE_FILE_REQUIRED'
  | 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_VALUE_REQUIRED'
  | 'WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT';

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
        return {
          path: '',
          writeFile,
          outputDir,
          error: 'WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT',
        };
      }
      writeFile = true;
      continue;
    }

    if (argument === '--output-dir') {
      if (outputDir !== null) {
        return {
          path: '',
          writeFile,
          outputDir,
          error: 'WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT',
        };
      }
      const value = args[index + 1];
      if (value === undefined || value.startsWith('-')) {
        return {
          path: '',
          writeFile,
          outputDir,
          error: 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_VALUE_REQUIRED',
        };
      }
      outputDir = value;
      index++;
      continue;
    }

    if (argument.startsWith('-')) {
      return {
        path: '',
        writeFile,
        outputDir,
        error: 'WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT',
      };
    }

    positionalPaths.push(argument);
  }

  if (positionalPaths.length === 0) {
    return {
      path: '',
      writeFile,
      outputDir,
      error: 'WEEKLY_RESEARCH_CONSTRUCTION_PATH_REQUIRED',
    };
  }
  if (positionalPaths.length > 1) {
    return {
      path: '',
      writeFile,
      outputDir,
      error: 'WEEKLY_RESEARCH_CONSTRUCTION_SINGLE_PATH_ONLY',
    };
  }
  if (writeFile && outputDir === null) {
    return {
      path: '',
      writeFile,
      outputDir,
      error: 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_REQUIRED',
    };
  }
  if (!writeFile && outputDir !== null) {
    return {
      path: '',
      writeFile,
      outputDir,
      error: 'WEEKLY_RESEARCH_CONSTRUCTION_WRITE_FILE_REQUIRED',
    };
  }

  return {
    path: positionalPaths[0],
    writeFile,
    outputDir,
    error: null,
  };
}

function isPathInsideOrEqual(parentPath: string, childPath: string): boolean {
  const relativePath = relative(parentPath, childPath);
  return relativePath === ''
    || (
      !relativePath.startsWith(`..${sep}`)
      && relativePath !== '..'
      && !isAbsolute(relativePath)
    );
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

function isUnsafeOutputDirectory(outputDir: string): boolean {
  const protectedRoots = [
    'src',
    'scripts',
    'tests',
    'docs',
    'prisma',
    'app',
  ].map((directory) => resolve(REPOSITORY_ROOT, directory));

  return protectedRoots.some((protectedRoot) => (
    isPathInsideOrEqual(protectedRoot, outputDir)
  ));
}

function isSafeFilenameComponent(value: string): boolean {
  return value.trim() !== ''
    && value !== '.'
    && value !== '..'
    && !value.includes('..')
    && !value.includes('/')
    && !value.includes('\\')
    && !value.includes(sep)
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
  return Object.entries(input as Record<string, unknown>).some(([key, value]) => (
    isAbsolute(key)
    || win32.isAbsolute(key)
    || containsAbsolutePath(value)
  ));
}

function writeArtifactWithoutOverwrite(
  outputDir: string,
  filename: string,
  artifact: unknown,
): string {
  mkdirSync(outputDir, { recursive: true });
  const physicalOutputDir = realpathSync(outputDir);
  const finalPath = resolve(physicalOutputDir, filename);

  if (
    !isPathInsideOrEqual(physicalOutputDir, finalPath)
    || isUnsafeOutputDirectory(physicalOutputDir)
  ) {
    throw Object.assign(
      new Error('unsafe output path'),
      { code: 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_UNSAFE' },
    );
  }
  if (existsSync(finalPath)) {
    throw Object.assign(
      new Error('output path exists'),
      { code: 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_PATH_EXISTS' },
    );
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
    try {
      linkSync(temporaryPath, finalPath);
    } catch (error) {
      const errorCode = error && typeof error === 'object' && 'code' in error
        ? (error as { code?: string }).code
        : undefined;
      if (errorCode === 'EEXIST') {
        throw Object.assign(
          new Error('output path exists'),
          { code: 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_PATH_EXISTS' },
        );
      }
      throw error;
    }
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

function isSafeSummaryString(input: unknown): input is string {
  return typeof input === 'string'
    && !isAbsolute(input)
    && !win32.isAbsolute(input);
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
    error: 'WEEKLY_RESEARCH_CONSTRUCTION_READ_OR_PARSE_FAILED',
    ...emptyValidationSummary(),
  });
  process.exit(1);
}

const validationMessages = validateMLBManualWeekLockedSnapshot(data);
const validationErrorCount = validationMessages.filter((message) => message.severity === 'error').length;
const validationWarningCount = validationMessages.filter((message) => message.severity === 'warning').length;
const record = typeof data === 'object' && data !== null && !Array.isArray(data)
  ? data as Record<string, unknown>
  : null;
const snapshot = record && typeof record.snapshot === 'object' && record.snapshot !== null
  ? record.snapshot as Record<string, unknown>
  : null;
const games = snapshot && Array.isArray(snapshot.games) ? snapshot.games : [];

const summary: Record<string, unknown> = {
  ok: validationErrorCount === 0,
};

for (const field of ['runId', 'lockId', 'sourceMode', 'weekStart', 'weekEnd'] as const) {
  if (record && isSafeSummaryString(record[field])) {
    summary[field] = record[field];
  }
}
if (record && isSafeSummaryString(record.lockedAt)) {
  summary.constructedAt = record.lockedAt;
  summary.lockedAt = record.lockedAt;
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

const constructionPackage = constructMLBWeeklyProspectiveResearchPackage(
  data as MLBManualWeekLockedSnapshot,
);

if (parsedArgs.writeFile) {
  const filenameComponents = [
    constructionPackage.weekStart,
    constructionPackage.weekEnd,
    constructionPackage.runId,
  ];
  const outputDir = parsedArgs.outputDir === null
    ? null
    : resolvePhysicalOutputDirectory(parsedArgs.outputDir);

  if (
    outputDir === null
    || isUnsafeOutputDirectory(outputDir)
    || filenameComponents.some((component) => !isSafeFilenameComponent(component))
    || containsAbsolutePath(constructionPackage)
  ) {
    summary.ok = false;
    summary.outputMode = 'file';
    summary.artifactWritten = false;
    summary.error = 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_UNSAFE';
    writeSummary(summary);
    process.exit(1);
  }

  const artifactFilename = [
    constructionPackage.weekStart,
    constructionPackage.weekEnd,
    constructionPackage.runId,
    'weekly-research-construction-v1.json',
  ].join('__');

  try {
    const finalPath = writeArtifactWithoutOverwrite(
      outputDir,
      artifactFilename,
      constructionPackage,
    );
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
    summary.error = errorCode === 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_PATH_EXISTS'
      ? 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_PATH_EXISTS'
      : errorCode === 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_UNSAFE'
        ? 'WEEKLY_RESEARCH_CONSTRUCTION_OUTPUT_DIR_UNSAFE'
        : 'WEEKLY_RESEARCH_CONSTRUCTION_WRITE_FAILED';
    writeSummary(summary);
    process.exit(1);
  }

  writeSummary(summary);
  process.exit(0);
}

summary.package = constructionPackage;
writeSummary(summary);
