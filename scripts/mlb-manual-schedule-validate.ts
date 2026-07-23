import { readFileSync } from 'node:fs';
import { validateMLBManualScheduleFile } from '@/prospective/mlb/manual-schedule-file';

type ValidationMessage = ReturnType<typeof validateMLBManualScheduleFile>[number];

function parseArgs(argv: string[]): { path: string; error: 'MANUAL_SCHEDULE_PATH_REQUIRED' | 'MANUAL_SCHEDULE_SINGLE_PATH_ONLY' | null } {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { path: '', error: 'MANUAL_SCHEDULE_PATH_REQUIRED' };
  }
  if (args.length > 1) {
    return { path: '', error: 'MANUAL_SCHEDULE_SINGLE_PATH_ONLY' };
  }
  return { path: args[0], error: null };
}

function readJsonFile(path: string): { data: unknown; error?: string } {
  try {
    const content = readFileSync(path, 'utf8');
    let data: unknown;
    try {
      data = JSON.parse(content);
    } catch (parseError) {
      return { data: null, error: `failed to parse JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}` };
    }
    return { data };
  } catch (readError) {
    return { data: null, error: `failed to read file: ${readError instanceof Error ? readError.message : String(readError)}` };
  }
}

const parsedArgs = parseArgs(process.argv);

if (parsedArgs === null || parsedArgs.error) {
  const summary = {
    ok: false,
    error: parsedArgs === null ? 'MANUAL_SCHEDULE_PATH_REQUIRED' : parsedArgs.error,
    usage: 'npm run prospective:mlb:validate-manual-schedule -- <path-to-json>',
    validationMessages: [],
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(1);
}

const filePath = parsedArgs.path;
const result = readJsonFile(filePath);

if (result.error) {
  const summary = {
    ok: false,
    error: 'MANUAL_SCHEDULE_READ_OR_PARSE_FAILED',
    message: result.error,
    validationMessages: [],
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(1);
}

const data = result.data;
const messages = validateMLBManualScheduleFile(data);
const parsed = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null;

if (parsed === null) {
  const summary = {
    ok: false,
    error: 'MANUAL_SCHEDULE_READ_OR_PARSE_FAILED',
    message: 'parsed file is not a JSON object',
    validationMessages: [],
  };
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  process.exit(1);
}

const games = Array.isArray(parsed.games) ? parsed.games : [];
const errorCount = messages.filter((m) => m.severity === 'error').length;
const warningCount = messages.filter((m) => m.severity === 'warning').length;

const summary: Record<string, unknown> = {
  ok: errorCount === 0,
};

if ('schemaVersion' in parsed && typeof parsed.schemaVersion === 'string') {
  summary.schemaVersion = parsed.schemaVersion;
}
if ('sport' in parsed && typeof parsed.sport === 'string') {
  summary.sport = parsed.sport;
}
if ('sourceMode' in parsed && typeof parsed.sourceMode === 'string') {
  summary.sourceMode = parsed.sourceMode;
}
if ('runId' in parsed && typeof parsed.runId === 'string') {
  summary.runId = parsed.runId;
}
if ('weekStart' in parsed && typeof parsed.weekStart === 'string') {
  summary.weekStart = parsed.weekStart;
}
if ('weekEnd' in parsed && typeof parsed.weekEnd === 'string') {
  summary.weekEnd = parsed.weekEnd;
}
summary.gameCount = games.length;
summary.validationMessageCount = messages.length;
summary.validationErrorCount = errorCount;
summary.validationWarningCount = warningCount;
summary.validationMessages = messages;

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (errorCount > 0) {
  process.exit(1);
}
