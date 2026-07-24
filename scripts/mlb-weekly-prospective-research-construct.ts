import { readFileSync } from 'node:fs';
import { isAbsolute, win32 } from 'node:path';
import {
  constructMLBWeeklyProspectiveResearchPackage,
  type MLBManualWeekLockedSnapshot,
  validateMLBManualWeekLockedSnapshot,
} from '@/prospective/mlb/weekly-research-construction';

const USAGE = 'npm run prospective:mlb:construct-week -- <locked-week-artifact-json>';

type ArgumentError =
  | 'WEEKLY_RESEARCH_CONSTRUCTION_PATH_REQUIRED'
  | 'WEEKLY_RESEARCH_CONSTRUCTION_SINGLE_PATH_ONLY'
  | 'WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT';

interface ParsedArgs {
  readonly path: string;
  readonly error: ArgumentError | null;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = argv.slice(2);

  if (args.some((argument) => argument.startsWith('-'))) {
    return { path: '', error: 'WEEKLY_RESEARCH_CONSTRUCTION_UNKNOWN_ARGUMENT' };
  }
  if (args.length === 0) {
    return { path: '', error: 'WEEKLY_RESEARCH_CONSTRUCTION_PATH_REQUIRED' };
  }
  if (args.length > 1) {
    return { path: '', error: 'WEEKLY_RESEARCH_CONSTRUCTION_SINGLE_PATH_ONLY' };
  }

  return { path: args[0], error: null };
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

summary.package = constructMLBWeeklyProspectiveResearchPackage(
  data as MLBManualWeekLockedSnapshot,
);
writeSummary(summary);
