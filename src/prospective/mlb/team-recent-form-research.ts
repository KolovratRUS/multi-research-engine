import { isAbsolute, win32 } from 'node:path';

export const RESEARCH_PACKAGE_VERSION = 'mlb-team-recent-form-research-package-v1';
export const TEAM_RECENT_FORM_MODULE_VERSION = 'mlb-team-recent-form-v1';
export const TEAM_RECENT_FORM_MODULE_NAME = 'TEAM_RECENT_FORM';
export const EXPECTED_CONSTRUCTION_VERSION = 'mlb-weekly-prospective-research-construction-v1';

export interface MLBTeamFormResearchValidationMessage {
  readonly code: string;
  readonly level: 'error' | 'warning';
  readonly path: string;
  readonly message: string;
}

export interface MLBTeamRecentFormConstructionGame {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
  readonly snapshotTimestamp: string;
  readonly sourceProvenance: string;
  readonly constructionStatus: string;
  readonly researchMode: 'pregame';
  readonly researchScope: 'FULL' | 'TEAM_ONLY';
  readonly constructionMessages: readonly unknown[];
  readonly warnings: readonly unknown[];
}

export interface MLBTeamRecentFormConstructionPackage {
  readonly constructionVersion: 'mlb-weekly-prospective-research-construction-v1';
  readonly runId: string;
  readonly lockId: string;
  readonly sourceMode: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly constructedAt: string;
  readonly lockedAt: string;
  readonly inputSnapshot: Readonly<Record<string, unknown>>;
  readonly games: readonly MLBTeamRecentFormConstructionGame[];
  readonly constructionWarnings: readonly unknown[];
  readonly constructionMessages: readonly unknown[];
  readonly [field: string]: unknown;
}

export interface MLBTeamRecentFormSummary {
  readonly status: 'not-evaluated';
  readonly reason: 'fixture-evidence-not-wired';
}

export interface MLBTeamRecentFormFinding {
  readonly moduleVersion: 'mlb-team-recent-form-v1';
  readonly scope: 'TEAM_ONLY';
  readonly awayTeam: string;
  readonly homeTeam: string;
  readonly lookbackWindowGames: 0;
  readonly lookbackWindowDays: 0;
  readonly awayRecentGamesFound: 0;
  readonly homeRecentGamesFound: 0;
  readonly awaySummary: MLBTeamRecentFormSummary;
  readonly homeSummary: MLBTeamRecentFormSummary;
  readonly dataQuality: 'not-evaluated';
  readonly volatility: 'not-evaluated';
  readonly confidence: 'not-evaluated';
  readonly warnings: readonly never[];
  readonly evidence: readonly never[];
}

export interface MLBTeamRecentFormResearchedGame extends MLBTeamRecentFormConstructionGame {
  readonly researchStatus: 'researched';
  readonly completedResearchModules: readonly ['TEAM_RECENT_FORM'];
  readonly researchFindings: {
    readonly teamRecentForm: MLBTeamRecentFormFinding;
  };
  readonly researchMessages: readonly never[];
  readonly researchWarnings: readonly never[];
}

export interface MLBTeamRecentFormResearchModuleResult {
  readonly moduleName: 'TEAM_RECENT_FORM';
  readonly moduleVersion: 'mlb-team-recent-form-v1';
  readonly scope: 'TEAM_ONLY';
  readonly status: 'completed';
  readonly messages: readonly never[];
  readonly warnings: readonly never[];
}

export interface MLBTeamRecentFormResearchPackage {
  readonly researchPackageVersion: 'mlb-team-recent-form-research-package-v1';
  readonly constructionVersion: 'mlb-weekly-prospective-research-construction-v1';
  readonly researchRunId: string;
  readonly sourceConstructionRunId: string;
  readonly sourceConstructionLockId: string;
  readonly sourceMode: string;
  readonly weekStart: string;
  readonly weekEnd: string;
  readonly researchedAt: string;
  readonly sourceConstructedAt: string;
  readonly sourceLockedAt: string;
  readonly inputConstructionPackage: MLBTeamRecentFormConstructionPackage;
  readonly games: readonly MLBTeamRecentFormResearchedGame[];
  readonly researchModules: readonly [MLBTeamRecentFormResearchModuleResult];
  readonly researchWarnings: readonly never[];
  readonly researchMessages: readonly never[];
}

const FORBIDDEN_FIELDS = new Set([
  'finalScore',
  'completedGameState',
  'actualStartingPitchers',
  'outcome',
  'outcomeStatus',
  'finalStatus',
  'closingOdds',
  'impliedProbability',
  'odds',
  'market',
  'price',
  'modelProbability',
]);

const ENVIRONMENT_METADATA_FIELDS = new Set([
  'environment',
  'env',
  'process',
  'cwd',
  'hostname',
]);

function validationError(
  code: string,
  path: string,
  message: string,
): MLBTeamFormResearchValidationMessage {
  return {
    code,
    level: 'error',
    path,
    message,
  };
}

function isPlainObject(input: unknown): input is Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(input);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(input: unknown): input is string {
  return typeof input === 'string' && input.trim() !== '';
}

function isAbsolutePathString(input: string): boolean {
  return isAbsolute(input) || win32.isAbsolute(input);
}

function propertyPath(parentPath: string, property: string): string {
  return `${parentPath}.${property}`;
}

function scanUnsafeInput(
  input: unknown,
  messages: MLBTeamFormResearchValidationMessage[],
  inputPath = '$',
): void {
  if (typeof input === 'string') {
    if (isAbsolutePathString(input)) {
      messages.push(validationError(
        'TEAM_FORM_RESEARCH_ABSOLUTE_PATH',
        inputPath,
        'construction package must not contain an absolute path',
      ));
    }
    return;
  }

  if (Array.isArray(input)) {
    for (let index = 0; index < input.length; index++) {
      scanUnsafeInput(input[index], messages, `${inputPath}[${index}]`);
    }
    return;
  }

  if (!isPlainObject(input)) {
    return;
  }

  for (const [property, value] of Object.entries(input)) {
    const absolutePathKey = isAbsolutePathString(property);
    const nextPath = absolutePathKey
      ? `${inputPath}.[absolute-path-key]`
      : propertyPath(inputPath, property);

    if (absolutePathKey) {
      messages.push(validationError(
        'TEAM_FORM_RESEARCH_ABSOLUTE_PATH',
        inputPath,
        'construction package must not contain an absolute path key',
      ));
    }
    if (FORBIDDEN_FIELDS.has(property)) {
      messages.push(validationError(
        'TEAM_FORM_RESEARCH_FORBIDDEN_FIELD',
        nextPath,
        `construction package must not contain forbidden field ${property}`,
      ));
    }
    if (ENVIRONMENT_METADATA_FIELDS.has(property)) {
      messages.push(validationError(
        'TEAM_FORM_RESEARCH_ENVIRONMENT_METADATA',
        nextPath,
        `construction package must not contain environment metadata field ${property}`,
      ));
    }
    scanUnsafeInput(value, messages, nextPath);
  }
}

function validateRequiredTopLevelFields(
  input: Record<string, unknown>,
  messages: MLBTeamFormResearchValidationMessage[],
): void {
  for (const field of [
    'runId',
    'lockId',
    'sourceMode',
    'weekStart',
    'weekEnd',
    'constructedAt',
    'lockedAt',
  ] as const) {
    if (!isNonEmptyString(input[field])) {
      messages.push(validationError(
        'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
        `$.${field}`,
        `construction package requires non-empty string ${field}`,
      ));
    }
  }

  if (!isPlainObject(input.inputSnapshot)) {
    messages.push(validationError(
      'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
      '$.inputSnapshot',
      'construction package requires inputSnapshot to be a plain object',
    ));
  }

  for (const field of ['constructionWarnings', 'constructionMessages'] as const) {
    if (!Array.isArray(input[field])) {
      messages.push(validationError(
        'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
        `$.${field}`,
        `construction package requires ${field} to be an array`,
      ));
    }
  }
}

function validateGame(
  game: unknown,
  index: number,
  messages: MLBTeamFormResearchValidationMessage[],
): void {
  const gamePath = `$.games[${index}]`;
  if (!isPlainObject(game)) {
    messages.push(validationError(
      'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
      gamePath,
      'constructed game must be a plain object',
    ));
    return;
  }

  for (const field of [
    'gameId',
    'officialDate',
    'scheduledStartTime',
    'awayTeam',
    'homeTeam',
    'snapshotTimestamp',
    'sourceProvenance',
    'constructionStatus',
  ] as const) {
    if (!isNonEmptyString(game[field])) {
      messages.push(validationError(
        'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
        `${gamePath}.${field}`,
        `constructed game requires non-empty string ${field}`,
      ));
    }
  }

  for (const field of ['constructionMessages', 'warnings'] as const) {
    if (!Array.isArray(game[field])) {
      messages.push(validationError(
        'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
        `${gamePath}.${field}`,
        `constructed game requires ${field} to be an array`,
      ));
    }
  }

  if (typeof game.researchMode !== 'string') {
    messages.push(validationError(
      'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
      `${gamePath}.researchMode`,
      'constructed game requires string researchMode',
    ));
  } else if (game.researchMode !== 'pregame') {
    messages.push(validationError(
      'TEAM_FORM_RESEARCH_MODE_UNSUPPORTED',
      `${gamePath}.researchMode`,
      'researchMode must be pregame',
    ));
  }

  if (typeof game.researchScope !== 'string') {
    messages.push(validationError(
      'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
      `${gamePath}.researchScope`,
      'constructed game requires string researchScope',
    ));
  } else if (game.researchScope !== 'FULL' && game.researchScope !== 'TEAM_ONLY') {
    messages.push(validationError(
      'TEAM_FORM_RESEARCH_SCOPE_UNSUPPORTED',
      `${gamePath}.researchScope`,
      'researchScope must be FULL or TEAM_ONLY',
    ));
  }
}

export function validateMLBTeamRecentFormConstructionPackage(
  input: unknown,
): MLBTeamFormResearchValidationMessage[] {
  if (!isPlainObject(input)) {
    return [validationError(
      'TEAM_FORM_RESEARCH_INPUT_NOT_OBJECT',
      '$',
      'construction package input must be a plain object',
    )];
  }

  const messages: MLBTeamFormResearchValidationMessage[] = [];
  scanUnsafeInput(input, messages);

  if (input.constructionVersion !== EXPECTED_CONSTRUCTION_VERSION) {
    messages.push(validationError(
      'TEAM_FORM_RESEARCH_CONSTRUCTION_VERSION_INVALID',
      '$.constructionVersion',
      `constructionVersion must be ${EXPECTED_CONSTRUCTION_VERSION}`,
    ));
  }

  validateRequiredTopLevelFields(input, messages);

  if (!Array.isArray(input.games)) {
    messages.push(validationError(
      'TEAM_FORM_RESEARCH_CONSTRUCTION_PACKAGE_INVALID',
      '$.games',
      'construction package requires games to be an array',
    ));
  } else if (input.games.length === 0) {
    messages.push(validationError(
      'TEAM_FORM_RESEARCH_EMPTY_GAMES',
      '$.games',
      'construction package games must not be empty',
    ));
  } else {
    for (let index = 0; index < input.games.length; index++) {
      validateGame(input.games[index], index, messages);
    }
  }

  return messages;
}

function buildTeamRecentFormFinding(
  game: MLBTeamRecentFormConstructionGame,
): MLBTeamRecentFormFinding {
  return {
    moduleVersion: TEAM_RECENT_FORM_MODULE_VERSION,
    scope: 'TEAM_ONLY',
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    lookbackWindowGames: 0,
    lookbackWindowDays: 0,
    awayRecentGamesFound: 0,
    homeRecentGamesFound: 0,
    awaySummary: {
      status: 'not-evaluated',
      reason: 'fixture-evidence-not-wired',
    },
    homeSummary: {
      status: 'not-evaluated',
      reason: 'fixture-evidence-not-wired',
    },
    dataQuality: 'not-evaluated',
    volatility: 'not-evaluated',
    confidence: 'not-evaluated',
    warnings: [],
    evidence: [],
  };
}

export function buildMLBTeamRecentFormResearchPackage(
  input: MLBTeamRecentFormConstructionPackage,
): MLBTeamRecentFormResearchPackage {
  const games = input.games.map<MLBTeamRecentFormResearchedGame>((game) => ({
    gameId: game.gameId,
    officialDate: game.officialDate,
    scheduledStartTime: game.scheduledStartTime,
    awayTeam: game.awayTeam,
    homeTeam: game.homeTeam,
    snapshotTimestamp: game.snapshotTimestamp,
    sourceProvenance: game.sourceProvenance,
    constructionStatus: game.constructionStatus,
    researchMode: game.researchMode,
    researchScope: game.researchScope,
    constructionMessages: game.constructionMessages,
    warnings: game.warnings,
    researchStatus: 'researched',
    completedResearchModules: [TEAM_RECENT_FORM_MODULE_NAME],
    researchFindings: {
      teamRecentForm: buildTeamRecentFormFinding(game),
    },
    researchMessages: [],
    researchWarnings: [],
  }));

  return {
    researchPackageVersion: RESEARCH_PACKAGE_VERSION,
    constructionVersion: input.constructionVersion,
    researchRunId: `team-recent-form:${input.runId}`,
    sourceConstructionRunId: input.runId,
    sourceConstructionLockId: input.lockId,
    sourceMode: input.sourceMode,
    weekStart: input.weekStart,
    weekEnd: input.weekEnd,
    researchedAt: input.constructedAt,
    sourceConstructedAt: input.constructedAt,
    sourceLockedAt: input.lockedAt,
    inputConstructionPackage: input,
    games,
    researchModules: [{
      moduleName: TEAM_RECENT_FORM_MODULE_NAME,
      moduleVersion: TEAM_RECENT_FORM_MODULE_VERSION,
      scope: 'TEAM_ONLY',
      status: 'completed',
      messages: [],
      warnings: [],
    }],
    researchWarnings: [],
    researchMessages: [],
  };
}
