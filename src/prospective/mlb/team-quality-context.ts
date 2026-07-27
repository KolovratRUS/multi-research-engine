export const TEAM_QUALITY_CONTEXT_MODULE_VERSION = 'mlb-team-quality-context-v1';
export const TEAM_QUALITY_CONTEXT_MODULE_NAME = 'TEAM_QUALITY_CONTEXT';
export const TEAM_QUALITY_CONTEXT_SCOPE = 'TEAM_ONLY';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export interface TeamQualityContextInputRecord {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
}

export interface TeamQualityContextTarget {
  readonly gameId: string;
  readonly officialDate: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
}

export interface TeamQualitySideContext {
  readonly status: 'not-evaluated' | 'insufficient' | 'partial' | 'complete';
  readonly reason:
    | 'not-evaluated'
    | 'insufficient-local-evidence'
    | 'thin-local-sample'
    | 'partial-local-sample'
    | 'complete-local-sample';
  readonly teamName: string;
  readonly localEvidenceGameCount: number;
  readonly opponentEvidenceGameCount: number;
  readonly recentOpponentEvidenceGameCount: number;
  readonly historicalSampleSizeLabel: 'none' | 'thin' | 'moderate' | 'broad';
  readonly opponentSampleSizeLabel: 'none' | 'thin' | 'moderate' | 'broad';
  readonly qualityContextCompletenessLabel: 'insufficient' | 'partial' | 'complete';
  readonly volatilityContextLabel: 'unavailable' | 'low' | 'moderate' | 'high';
  readonly scheduleAdjustedContextLabel: 'unavailable' | 'limited' | 'supported';
  readonly qualityContextWarnings: readonly string[];
  readonly dataQuality: 'insufficient' | 'partial' | 'usable';
  readonly confidence: 'low' | 'medium' | 'high';
  readonly researchStrengthScore: 'low' | 'medium' | 'high';
}

export interface TeamQualityContext {
  readonly moduleVersion: typeof TEAM_QUALITY_CONTEXT_MODULE_VERSION;
  readonly moduleName: typeof TEAM_QUALITY_CONTEXT_MODULE_NAME;
  readonly scope: typeof TEAM_QUALITY_CONTEXT_SCOPE;
  readonly awayTeamQualityContext: TeamQualitySideContext;
  readonly homeTeamQualityContext: TeamQualitySideContext;
}

const FORBIDDEN_QUALITY_FIELDS = new Set([
  'modelProbability',
  'predictedWinner',
  'pick',
  'winChance',
  'powerRating',
  'teamRank',
  'standingsPosition',
  'finalScore',
  'outcome',
  'completedGameState',
  'finalStatus',
  'actualStartingPitchers',
  'pitcher',
  'odds',
  'sportsbook',
  'market',
  'price',
]);

function parseISODateTime(value: string): Date | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function scanQualityInputRecordForbiddenFields(
  input: object,
): string[] {
  const found: string[] = [];
  for (const key of Object.keys(input)) {
    if (FORBIDDEN_QUALITY_FIELDS.has(key)) {
      found.push(key);
    }
  }
  return found;
}

function buildSideContextForTeam(
  team: string,
  targetGameId: string,
  records: readonly TeamQualityContextInputRecord[],
  scheduleAdjustedContextLabel: 'unavailable' | 'limited' | 'supported',
  invalidTimestampSeen: boolean,
  forbiddenFieldsFound: readonly string[],
): TeamQualitySideContext {
  const validRecords = records
    .filter((record) => record.awayTeam === team || record.homeTeam === team)
    .filter((record) => record.gameId !== targetGameId)
    .filter((record) => parseISODateTime(record.scheduledStartTime) !== null)
    .sort((a, b) => a.scheduledStartTime.localeCompare(b.scheduledStartTime));

  const localEvidenceGameCount = validRecords.length;
  const opponentSet = new Set<string>();
  const recentOpponentSet = new Set<string>();
  const recentLimit = Math.min(3, validRecords.length);
  for (let index = 0; index < localEvidenceGameCount; index++) {
    const record = validRecords[index];
    const opponent = record.awayTeam === team ? record.homeTeam : record.awayTeam;
    opponentSet.add(opponent);
    if (index >= localEvidenceGameCount - recentLimit) {
      recentOpponentSet.add(opponent);
    }
  }

  const opponentEvidenceGameCount = opponentSet.size;
  const recentOpponentEvidenceGameCount = recentOpponentSet.size;

  const warningsArray: string[] = [];
  if (localEvidenceGameCount === 0) {
    warningsArray.push('TEAM_QUALITY_CONTEXT_NO_LOCAL_EVIDENCE');
  }
  if (localEvidenceGameCount > 0 && opponentEvidenceGameCount <= 1) {
    warningsArray.push('TEAM_QUALITY_CONTEXT_INSUFFICIENT_OPPONENT_EVIDENCE');
  }
  if (localEvidenceGameCount > 0 && opponentEvidenceGameCount === 0) {
    warningsArray.push('TEAM_QUALITY_CONTEXT_SYNTHETIC_FIXTURE_ONLY');
  }
  if (localEvidenceGameCount >= 1 && localEvidenceGameCount <= 2) {
    warningsArray.push('TEAM_QUALITY_CONTEXT_RECENT_SAMPLE_THIN');
  }
  if (scheduleAdjustedContextLabel === 'unavailable') {
    warningsArray.push('TEAM_QUALITY_CONTEXT_SCHEDULE_CONTEXT_UNAVAILABLE');
  }
  if (forbiddenFieldsFound.length > 0) {
    warningsArray.push('TEAM_QUALITY_CONTEXT_FORBIDDEN_FIELD_STRIPPED');
  }
  if (invalidTimestampSeen) {
    warningsArray.push('TEAM_QUALITY_CONTEXT_INVALID_TIMESTAMP');
  }

  const qualityContextWarnings = [...new Set(warningsArray)].sort();

  const status: TeamQualitySideContext['status'] =
    localEvidenceGameCount === 0
      ? 'insufficient'
      : localEvidenceGameCount <= 2
        ? 'partial'
        : localEvidenceGameCount <= 5
          ? 'partial'
          : 'complete';

  const reason: TeamQualitySideContext['reason'] =
    localEvidenceGameCount === 0
      ? 'insufficient-local-evidence'
      : localEvidenceGameCount <= 2
        ? 'thin-local-sample'
        : localEvidenceGameCount <= 5
          ? 'partial-local-sample'
          : 'complete-local-sample';

  const historicalSampleSizeLabel: TeamQualitySideContext['historicalSampleSizeLabel'] =
    localEvidenceGameCount === 0
      ? 'none'
      : localEvidenceGameCount <= 2
        ? 'thin'
        : localEvidenceGameCount <= 5
          ? 'moderate'
          : 'broad';

  const opponentSampleSizeLabel: TeamQualitySideContext['opponentSampleSizeLabel'] =
    opponentEvidenceGameCount === 0
      ? 'none'
      : opponentEvidenceGameCount <= 2
        ? 'thin'
        : opponentEvidenceGameCount <= 5
          ? 'moderate'
          : 'broad';

  const qualityContextCompletenessLabel: TeamQualitySideContext['qualityContextCompletenessLabel'] =
    localEvidenceGameCount === 0
      ? 'insufficient'
      : localEvidenceGameCount <= 5
        ? 'partial'
        : 'complete';

  const volatilityContextLabel: TeamQualitySideContext['volatilityContextLabel'] =
    localEvidenceGameCount === 0
      ? 'unavailable'
      : localEvidenceGameCount <= 2
        ? 'high'
        : localEvidenceGameCount <= 5
          ? 'moderate'
          : 'low';

  const dataQuality: TeamQualitySideContext['dataQuality'] =
    localEvidenceGameCount === 0
      ? 'insufficient'
      : localEvidenceGameCount <= 5
        ? 'partial'
        : 'usable';

  const confidence: TeamQualitySideContext['confidence'] =
    localEvidenceGameCount <= 2
      ? 'low'
      : localEvidenceGameCount <= 5
        ? 'medium'
        : 'high';

  const researchStrengthScore: TeamQualitySideContext['researchStrengthScore'] =
    localEvidenceGameCount <= 2
      ? 'low'
      : localEvidenceGameCount <= 5
        ? 'medium'
        : 'high';

  return {
    status,
    reason,
    teamName: team,
    localEvidenceGameCount,
    opponentEvidenceGameCount,
    recentOpponentEvidenceGameCount,
    historicalSampleSizeLabel,
    opponentSampleSizeLabel,
    qualityContextCompletenessLabel,
    volatilityContextLabel,
    scheduleAdjustedContextLabel,
    qualityContextWarnings,
    dataQuality,
    confidence,
    researchStrengthScore,
  };
}

export function buildTeamQualityContext(
  target: TeamQualityContextTarget,
  localRecords: readonly TeamQualityContextInputRecord[],
  optionalScheduleContext?: TeamQualityContextTarget | null,
): TeamQualityContext {
  const invalidTimestampSeen = localRecords.some(
    (record) => parseISODateTime(record.scheduledStartTime) === null,
  );

  const ignoredForbiddenFields: string[] = [];
  if (invalidTimestampSeen) {
    ignoredForbiddenFields.push('scheduledStartTime');
  }
  for (const record of localRecords) {
    ignoredForbiddenFields.push(...scanQualityInputRecordForbiddenFields(record));
  }

  const scheduleAdjustedContextLabel =
    !optionalScheduleContext || parseISODateTime(optionalScheduleContext.scheduledStartTime) === null
      ? 'unavailable'
      : 'unavailable';

  return {
    moduleVersion: TEAM_QUALITY_CONTEXT_MODULE_VERSION,
    moduleName: TEAM_QUALITY_CONTEXT_MODULE_NAME,
    scope: TEAM_QUALITY_CONTEXT_SCOPE,
    awayTeamQualityContext: buildSideContextForTeam(
      target.awayTeam,
      target.gameId,
      localRecords,
      scheduleAdjustedContextLabel,
      invalidTimestampSeen,
      ignoredForbiddenFields,
    ),
    homeTeamQualityContext: buildSideContextForTeam(
      target.homeTeam,
      target.gameId,
      localRecords,
      scheduleAdjustedContextLabel,
      invalidTimestampSeen,
      ignoredForbiddenFields,
    ),
  };
}

export const TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE =
  'TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE';

export function validateTeamQualityContextModeFlags({
  fixtureEvidenceLocal,
  teamQualityContextLocal,
}: {
  readonly fixtureEvidenceLocal: boolean;
  readonly teamQualityContextLocal: boolean;
}): string | null {
  if (!teamQualityContextLocal) {
    return null;
  }
  if (!fixtureEvidenceLocal) {
    return TEAM_QUALITY_CONTEXT_REQUIRES_FIXTURE_EVIDENCE;
  }
  return null;
}
