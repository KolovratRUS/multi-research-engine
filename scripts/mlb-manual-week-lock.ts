import { readFileSync } from 'node:fs';
import {
  buildScheduleSnapshotFromManualScheduleFile,
  type MLBManualScheduleFile,
  validateMLBManualScheduleFile,
} from '@/prospective/mlb/manual-schedule-file';

const USAGE = 'npm run prospective:mlb:lock-manual-week -- <path-to-json>';
const LOCK_VERSION = 'mlb-manual-week-lock-v1';

type ArgumentError =
  | 'MANUAL_WEEK_LOCK_PATH_REQUIRED'
  | 'MANUAL_WEEK_LOCK_SINGLE_PATH_ONLY';

function parseArgs(argv: string[]): { path: string; error: ArgumentError | null } {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { path: '', error: 'MANUAL_WEEK_LOCK_PATH_REQUIRED' };
  }
  if (args.length > 1) {
    return { path: '', error: 'MANUAL_WEEK_LOCK_SINGLE_PATH_ONLY' };
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

summary.lockedSnapshot = {
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

writeSummary(summary);
