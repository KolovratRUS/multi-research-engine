import { readFileSync } from 'node:fs';
import {
  buildMLBTeamRecentFormResearchPackage,
  type MLBTeamRecentFormConstructionPackage,
  validateMLBTeamRecentFormConstructionPackage,
} from '@/prospective/mlb/team-recent-form-research';

const USAGE = 'npm run prospective:mlb:research-team-form -- <construction-package-json>';

type ArgumentError =
  | 'TEAM_FORM_RESEARCH_PATH_REQUIRED'
  | 'TEAM_FORM_RESEARCH_SINGLE_PATH_ONLY'
  | 'TEAM_FORM_RESEARCH_UNKNOWN_ARGUMENT';

interface ParsedArguments {
  readonly path: string;
  readonly error: ArgumentError | null;
}

function parseArguments(argv: string[]): ParsedArguments {
  const args = argv.slice(2);
  const positionalPaths: string[] = [];

  for (const argument of args) {
    if (argument.startsWith('-')) {
      return {
        path: '',
        error: 'TEAM_FORM_RESEARCH_UNKNOWN_ARGUMENT',
      };
    }
    positionalPaths.push(argument);
  }

  if (positionalPaths.length === 0) {
    return {
      path: '',
      error: 'TEAM_FORM_RESEARCH_PATH_REQUIRED',
    };
  }
  if (positionalPaths.length > 1) {
    return {
      path: '',
      error: 'TEAM_FORM_RESEARCH_SINGLE_PATH_ONLY',
    };
  }

  return {
    path: positionalPaths[0],
    error: null,
  };
}

function writeSummary(summary: Readonly<Record<string, unknown>>): void {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

function emptyValidationSummary(): Record<string, unknown> {
  return {
    validationMessageCount: 0,
    validationErrorCount: 0,
    validationWarningCount: 0,
    validationMessages: [],
  };
}

const parsedArguments = parseArguments(process.argv);

if (parsedArguments.error) {
  writeSummary({
    ok: false,
    ...emptyValidationSummary(),
    error: parsedArguments.error,
    usage: USAGE,
  });
  process.exit(1);
}

let input: unknown;
try {
  input = JSON.parse(readFileSync(parsedArguments.path, 'utf8')) as unknown;
} catch {
  writeSummary({
    ok: false,
    ...emptyValidationSummary(),
    error: 'TEAM_FORM_RESEARCH_READ_OR_PARSE_FAILED',
  });
  process.exit(1);
}

const validationMessages = validateMLBTeamRecentFormConstructionPackage(input);
const validationErrorCount = validationMessages.filter(
  (message) => message.level === 'error',
).length;
const validationWarningCount = validationMessages.filter(
  (message) => message.level === 'warning',
).length;

if (validationErrorCount > 0) {
  writeSummary({
    ok: false,
    validationMessageCount: validationMessages.length,
    validationErrorCount,
    validationWarningCount,
    validationMessages,
    error: validationMessages.find((message) => message.level === 'error')?.code
      ?? 'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
  });
  process.exit(1);
}

const researchPackage = buildMLBTeamRecentFormResearchPackage(
  input as MLBTeamRecentFormConstructionPackage,
);

writeSummary({
  ok: true,
  researchPackageVersion: researchPackage.researchPackageVersion,
  researchRunId: researchPackage.researchRunId,
  sourceConstructionRunId: researchPackage.sourceConstructionRunId,
  sourceConstructionLockId: researchPackage.sourceConstructionLockId,
  sourceMode: researchPackage.sourceMode,
  weekStart: researchPackage.weekStart,
  weekEnd: researchPackage.weekEnd,
  researchedAt: researchPackage.researchedAt,
  sourceConstructedAt: researchPackage.sourceConstructedAt,
  sourceLockedAt: researchPackage.sourceLockedAt,
  gameCount: researchPackage.games.length,
  validationMessageCount: validationMessages.length,
  validationErrorCount,
  validationWarningCount,
  validationMessages,
  package: researchPackage,
});
