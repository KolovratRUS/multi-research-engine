export const TEAM_SCHEDULE_CONTEXT_MODULE_VERSION = 'mlb-team-schedule-context-v1';
export const TEAM_SCHEDULE_CONTEXT_MODULE_NAME = 'TEAM_SCHEDULE_CONTEXT';
export const TEAM_SCHEDULE_CONTEXT_NOT_ENABLED = 'TEAM_SCHEDULE_CONTEXT_NOT_ENABLED';
export const TEAM_SCHEDULE_CONTEXT_REQUIRES_FIXTURE_EVIDENCE =
  'TEAM_SCHEDULE_CONTEXT_REQUIRES_FIXTURE_EVIDENCE';

const DEFAULT_RECENCY_WINDOW_DAYS = 7;
const DEFAULT_FUTURE_WINDOW_DAYS = 7;
const DEFAULT_CONSECUTIVE_LOOKBACK = 5;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface TeamScheduleContextRecord {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
}

export interface TeamScheduleContextTarget {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
}

export interface TeamScheduleContextTeamResult {
  readonly status: 'not-evaluated' | 'insufficient' | 'partial' | 'complete';
  readonly reason:
    | 'not-evaluated'
    | 'insufficient-schedule-evidence'
    | 'missing-previous-game'
    | 'missing-next-game'
    | 'invalid-timestamp'
    | 'partial-schedule-evidence'
    | 'complete-schedule-evidence';
  readonly recencyWindowDays: number;
  readonly futureWindowDays: number;
  readonly previousGameScheduledAt: string | null;
  readonly nextGameScheduledAt: string | null;
  readonly daysSincePreviousGame: number | null;
  readonly hoursSincePreviousGame: number | null;
  readonly daysUntilNextGame: number | null;
  readonly hoursUntilNextGame: number | null;
  readonly gamesInLast3Days: number;
  readonly gamesInLast7Days: number;
  readonly gamesInNext3Days: number;
  readonly gamesInNext7Days: number;
  readonly consecutiveRoadGames: number;
  readonly consecutiveHomeGames: number;
  readonly homeAwaySequenceLabel: string;
  readonly scheduleDensityLabel: string;
  readonly restAdvantageLabel: string;
  readonly travelBurdenLabel: string;
  readonly scheduleContextCompletenessLabel: string;
  readonly scheduleContextWarnings: readonly string[];
}

export interface TeamScheduleContext {
  readonly moduleVersion: typeof TEAM_SCHEDULE_CONTEXT_MODULE_VERSION;
  readonly moduleName: typeof TEAM_SCHEDULE_CONTEXT_MODULE_NAME;
  readonly scope: 'TEAM_ONLY';
  readonly awayTeam: string;
  readonly homeTeam: string;
  readonly awayScheduleContext: TeamScheduleContextTeamResult;
  readonly homeScheduleContext: TeamScheduleContextTeamResult;
}

export interface MLBTeamScheduleContextResearchModuleResult {
  readonly moduleName: typeof TEAM_SCHEDULE_CONTEXT_MODULE_NAME;
  readonly moduleVersion: typeof TEAM_SCHEDULE_CONTEXT_MODULE_VERSION;
  readonly scope: 'TEAM_ONLY';
  readonly status: 'completed';
  readonly messages: readonly unknown[];
  readonly warnings: readonly unknown[];
}

function parseISODateTime(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function diffInHours(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / (60 * 60 * 1000));
}

function diffInDays(start: Date, end: Date): number {
  return Math.round((end.getTime() - start.getTime()) / ONE_DAY_MS);
}

function countGamesInWindow(
  games: readonly (TeamScheduleContextRecord & { readonly parsedTime: Date })[],
  start: Date,
  endExclusive: Date,
  maxDays: number,
): number {
  const limit = new Date(start.getTime() + maxDays * ONE_DAY_MS);
  const ceiling = Math.min(limit.getTime(), endExclusive.getTime());
  return games.filter((record) => {
    const time = record.parsedTime.getTime();
    return time > start.getTime() && time < ceiling;
  }).length;
}

function computeConsecutiveRoleGames(
  games: readonly (TeamScheduleContextRecord & {
    readonly parsedTime: Date;
    readonly teamRole: 'HOME' | 'AWAY';
  })[],
  role: 'HOME' | 'AWAY',
): number {
  let count = 0;
  for (let index = games.length - 1; index >= 0; index--) {
    if (games[index].teamRole === role) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function computeHomeAwaySequenceLabel(
  games: readonly (TeamScheduleContextRecord & {
    readonly parsedTime: Date;
    readonly teamRole: 'HOME' | 'AWAY';
  })[],
  lookback: number,
): string {
  const recent = games.slice(-lookback);
  if (recent.length === 0) {
    return 'insufficient';
  }

  const lastRole = recent[recent.length - 1].teamRole;
  let streak = 0;
  for (let index = recent.length - 1; index >= 0; index--) {
    if (recent[index].teamRole === lastRole) {
      streak++;
    } else {
      break;
    }
  }

  if (streak >= 3) {
    return lastRole === 'HOME' ? 'home-streak' : 'away-streak';
  }
  if (recent.length >= 3) {
    return 'mixed';
  }
  if (recent.length === 1) {
    return lastRole === 'HOME' ? 'home' : 'away';
  }
  return 'mixed';
}

function buildTeamScheduleContextForTeam(
  team: string,
  targetTime: Date,
  targetGameId: string,
  scheduleRecords: readonly TeamScheduleContextRecord[],
  recencyWindowDays: number,
  futureWindowDays: number,
): TeamScheduleContextTeamResult {
  const teamGames = scheduleRecords
    .filter((record) => record.awayTeam === team || record.homeTeam === team)
    .filter((record) => record.gameId !== targetGameId)
    .map((record) => ({
      ...record,
      teamRole: record.awayTeam === team ? 'AWAY' : 'HOME',
      parsedTime: parseISODateTime(record.scheduledStartTime),
    }))
    .filter((record): record is TeamScheduleContextRecord & {
      readonly teamRole: 'HOME' | 'AWAY';
      readonly parsedTime: Date;
    } => record.parsedTime !== null)
    .sort((a, b) => a.parsedTime.getTime() - b.parsedTime.getTime());

  const pastGames = teamGames.filter((record) => record.parsedTime.getTime() < targetTime.getTime());
  const futureGames = teamGames.filter((record) => record.parsedTime.getTime() > targetTime.getTime());

  const previousGame = pastGames.length > 0 ? pastGames[pastGames.length - 1] : null;
  const nextGame = futureGames.length > 0 ? futureGames[0] : null;

  const previousTime = previousGame ? previousGame.parsedTime : null;
  const nextTime = nextGame ? nextGame.parsedTime : null;

  const daysSincePreviousGame = previousTime ? diffInDays(previousTime, targetTime) : null;
  const hoursSincePreviousGame = previousTime ? diffInHours(previousTime, targetTime) : null;
  const daysUntilNextGame = nextTime ? diffInDays(targetTime, nextTime) : null;
  const hoursUntilNextGame = nextTime ? diffInHours(targetTime, nextTime) : null;

  const pastWindowEnd = targetTime;
  const pastWindowStart = new Date(targetTime.getTime() - recencyWindowDays * ONE_DAY_MS);
  const futureWindowStart = targetTime;
  const futureWindowEnd = new Date(
    Math.max(
      targetTime.getTime(),
      targetTime.getTime() + futureWindowDays * ONE_DAY_MS,
    ),
  );

  const gamesInLast3Days = countGamesInWindow(pastGames, pastWindowStart, pastWindowEnd, 3);
  const gamesInLast7Days = countGamesInWindow(pastGames, pastWindowStart, pastWindowEnd, 7);
  const gamesInNext3Days = countGamesInWindow(futureGames, futureWindowStart, futureWindowEnd, 3);
  const gamesInNext7Days = countGamesInWindow(futureGames, futureWindowStart, futureWindowEnd, 7);

  const consecutiveRoadGames = computeConsecutiveRoleGames(pastGames, 'AWAY');
  const consecutiveHomeGames = computeConsecutiveRoleGames(pastGames, 'HOME');

  const homeAwaySequenceLabel = computeHomeAwaySequenceLabel(
    pastGames,
    DEFAULT_CONSECUTIVE_LOOKBACK,
  );
  const scheduleDensityLabel =
    gamesInLast7Days >= 6
      ? 'high-density'
      : gamesInLast7Days >= 4
        ? 'elevated-density'
        : gamesInLast7Days >= 2
          ? 'moderate-density'
          : gamesInLast7Days === 1
            ? 'low-density'
            : 'no-recent-games';
  const restAdvantageLabel = hoursSincePreviousGame === null
    ? 'unknown'
    : hoursSincePreviousGame >= 96
      ? 'rested'
      : hoursSincePreviousGame >= 72
        ? 'standard-rest'
        : hoursSincePreviousGame >= 48
          ? 'compressed-rest'
          : 'minimal-rest';
  const travelBurdenLabel = 'insufficient';

  const warnings: string[] = [];
  if (teamGames.length === 0) {
    warnings.push('TEAM_SCHEDULE_CONTEXT_NO_RECORDS');
  }

  const status = teamGames.length === 0
    ? 'insufficient'
    : previousGame && nextGame
      ? 'complete'
      : 'partial';

  const reason = teamGames.length === 0
    ? 'insufficient-schedule-evidence'
    : previousGame && nextGame
      ? 'complete-schedule-evidence'
      : 'partial-schedule-evidence';

  const scheduleContextCompletenessLabel = teamGames.length === 0
    ? 'insufficient'
    : previousGame && nextGame
      ? 'complete'
      : 'partial';

  const uniqueWarnings = [...new Set(warnings)].sort();

  return {
    status,
    reason,
    recencyWindowDays,
    futureWindowDays,
    previousGameScheduledAt: previousTime ? previousTime.toISOString() : null,
    nextGameScheduledAt: nextTime ? nextTime.toISOString() : null,
    daysSincePreviousGame,
    hoursSincePreviousGame,
    daysUntilNextGame,
    hoursUntilNextGame,
    gamesInLast3Days,
    gamesInLast7Days,
    gamesInNext3Days,
    gamesInNext7Days,
    consecutiveRoadGames,
    consecutiveHomeGames,
    homeAwaySequenceLabel,
    scheduleDensityLabel,
    restAdvantageLabel,
    travelBurdenLabel,
    scheduleContextCompletenessLabel,
    scheduleContextWarnings: uniqueWarnings,
  };
}

const INVALID_TIMESTAMP_TEAM_CONTEXT: TeamScheduleContextTeamResult = {
  status: 'not-evaluated',
  reason: 'invalid-timestamp',
  recencyWindowDays: DEFAULT_RECENCY_WINDOW_DAYS,
  futureWindowDays: DEFAULT_FUTURE_WINDOW_DAYS,
  previousGameScheduledAt: null,
  nextGameScheduledAt: null,
  daysSincePreviousGame: null,
  hoursSincePreviousGame: null,
  daysUntilNextGame: null,
  hoursUntilNextGame: null,
  gamesInLast3Days: 0,
  gamesInLast7Days: 0,
  gamesInNext3Days: 0,
  gamesInNext7Days: 0,
  consecutiveRoadGames: 0,
  consecutiveHomeGames: 0,
  homeAwaySequenceLabel: 'insufficient',
  scheduleDensityLabel: 'no-recent-games',
  restAdvantageLabel: 'unknown',
  travelBurdenLabel: 'insufficient',
  scheduleContextCompletenessLabel: 'insufficient',
  scheduleContextWarnings: ['TEAM_SCHEDULE_CONTEXT_INVALID_TIMESTAMP'],
};

export function buildTeamScheduleContext(
  target: TeamScheduleContextTarget,
  scheduleRecords: readonly TeamScheduleContextRecord[],
  recencyWindowDays = DEFAULT_RECENCY_WINDOW_DAYS,
  futureWindowDays = DEFAULT_FUTURE_WINDOW_DAYS,
): TeamScheduleContext {
  const targetTime = parseISODateTime(target.scheduledStartTime);
  const invalidTimestamp = targetTime === null;

  const awayContext = invalidTimestamp
    ? INVALID_TIMESTAMP_TEAM_CONTEXT
    : buildTeamScheduleContextForTeam(
        target.awayTeam,
        targetTime,
        target.gameId,
        scheduleRecords,
        recencyWindowDays,
        futureWindowDays,
      );

  const homeContext = invalidTimestamp
    ? INVALID_TIMESTAMP_TEAM_CONTEXT
    : buildTeamScheduleContextForTeam(
        target.homeTeam,
        targetTime,
        target.gameId,
        scheduleRecords,
        recencyWindowDays,
        futureWindowDays,
      );

  return {
    moduleVersion: TEAM_SCHEDULE_CONTEXT_MODULE_VERSION,
    moduleName: TEAM_SCHEDULE_CONTEXT_MODULE_NAME,
    scope: 'TEAM_ONLY',
    awayTeam: target.awayTeam,
    homeTeam: target.homeTeam,
    awayScheduleContext: awayContext,
    homeScheduleContext: homeContext,
  };
}

export function validateScheduleContextModeFlags({
  fixtureEvidenceLocal,
  teamScheduleContextLocal,
}: {
  readonly fixtureEvidenceLocal: boolean;
  readonly teamScheduleContextLocal: boolean;
}): string | null {
  if (!teamScheduleContextLocal) {
    return null;
  }
  if (!fixtureEvidenceLocal) {
    return TEAM_SCHEDULE_CONTEXT_REQUIRES_FIXTURE_EVIDENCE;
  }
  return null;
}
