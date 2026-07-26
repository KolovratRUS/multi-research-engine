import { isAbsolute, win32 } from 'node:path';

/* -------------------------------------------------------------------------- */
/*  Warning / status codes                                                    */
/* -------------------------------------------------------------------------- */

export const TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_GAMES = 3;
export const TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_DAYS = 30;

export const TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES = 'TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES';
export const TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION = 'TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION';
export const TEAM_FORM_EVIDENCE_TARGET_GAME_EXCLUDED = 'TEAM_FORM_EVIDENCE_TARGET_GAME_EXCLUDED';
export const TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED = 'TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED';
export const TEAM_FORM_EVIDENCE_PITCHER_FIELDS_EXCLUDED = 'TEAM_FORM_EVIDENCE_PITCHER_FIELDS_EXCLUDED';
export const TEAM_FORM_EVIDENCE_FORBIDDEN_FIELD_EXCLUDED = 'TEAM_FORM_EVIDENCE_FORBIDDEN_FIELD_EXCLUDED';
export const TEAM_FORM_EVIDENCE_INVALID_TARGET = 'TEAM_FORM_EVIDENCE_INVALID_TARGET';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface TeamRecentFormEvidenceTarget {
  readonly gameId: string;
  readonly scheduledStartTime: string;
  readonly awayTeam: string;
  readonly homeTeam: string;
}

export interface TeamRecentFormEvidenceRecord {
  readonly gameId?: string | number;
  readonly officialDate?: string;
  readonly scheduledStartTime?: string;
  readonly gameDate?: string;
  readonly awayTeam?: string;
  readonly homeTeam?: string;
  readonly liveData?: Readonly<{
    readonly plays?: Readonly<{
      readonly allPlays?: ReadonlyArray<Readonly<{
        readonly about?: Readonly<{
          readonly endTime?: string;
        }>;
      }>>;
    }>;
  }>;
  readonly provenance?: Readonly<{
    readonly lastCompletedPlayEnd?: string;
  }>;
}

export interface TeamRecentFormEvidenceItem {
  readonly sourceGameId: string;
  readonly officialDate: string;
  readonly completedAt: string;
  readonly team: string;
  readonly teamRole: 'HOME' | 'AWAY';
  readonly opponent: string;
  readonly sourceProvenance: string;
}

export interface TeamRecentFormTeamEvidenceSummary {
  readonly recentGamesFound: number;
  readonly summary: {
    readonly status: 'complete' | 'partial' | 'insufficient' | 'not-evaluated';
    readonly reason: 'complete-evidence' | 'partial-evidence' | 'insufficient-evidence' | 'not-evaluated' | 'no-safe-completion' | 'invalid-target-scheduled-start-time';
  };
}

export interface TeamRecentFormFixtureEvidenceResult {
  readonly lookbackWindowGames: number;
  readonly lookbackWindowDays: number;
  readonly awayRecentGamesFound: number;
  readonly homeRecentGamesFound: number;
  readonly awaySummary: TeamRecentFormTeamEvidenceSummary;
  readonly homeSummary: TeamRecentFormTeamEvidenceSummary;
  readonly dataQuality: 'complete' | 'partial' | 'insufficient' | 'not-evaluated';
  readonly volatility: 'low' | 'medium' | 'high' | 'not-evaluated';
  readonly confidence: 'high' | 'medium' | 'low' | 'not-evaluated';
  readonly warnings: readonly string[];
  readonly evidence: readonly TeamRecentFormEvidenceItem[];
}

export interface TeamRecentFormFixtureEvidenceLookback {
  readonly lookbackWindowGames?: number;
  readonly lookbackWindowDays?: number;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function asNonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function getSafeCompletion(
  record: TeamRecentFormEvidenceRecord,
): { readonly completedAt: string; readonly provenance: string } | null {
  const allPlays = record.liveData?.plays?.allPlays;
  if (!Array.isArray(allPlays) || allPlays.length === 0) {
    return null;
  }

  const lastPlay = allPlays[allPlays.length - 1];
  const endTime = typeof lastPlay?.about?.endTime === 'string'
    ? lastPlay.about.endTime.trim()
    : '';
  if (endTime === '') {
    return null;
  }

  if (record.provenance?.lastCompletedPlayEnd !== 'LAST_COMPLETED_PLAY_END') {
    return null;
  }

  return { completedAt: endTime, provenance: 'LAST_COMPLETED_PLAY_END' };
}

function recordContainsPitcherFields(record: TeamRecentFormEvidenceRecord): boolean {
  const raw = record as Record<string, unknown>;
  return (
    'probablePitchers' in raw ||
    'startingPitchers' in raw ||
    'actualStartingPitchers' in raw
  );
}

const FORBIDDEN_EVIDENCE_FIELDS = new Set([
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

function recordContainsForbiddenFields(record: TeamRecentFormEvidenceRecord): boolean {
  const raw = record as Record<string, unknown>;
  for (const field of FORBIDDEN_EVIDENCE_FIELDS) {
    if (field in raw) {
      return true;
    }
  }
  return false;
}

function toMillis(input: string): number {
  const millis = new Date(input).getTime();
  if (Number.isNaN(millis)) {
    return NaN;
  }
  return millis;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                 */
/* -------------------------------------------------------------------------- */

export function buildMLBTeamRecentFormFixtureEvidence(
  target: TeamRecentFormEvidenceTarget,
  historicalFixtures: readonly TeamRecentFormEvidenceRecord[],
  lookback?: TeamRecentFormFixtureEvidenceLookback,
): TeamRecentFormFixtureEvidenceResult {
  const lookbackWindowGames = lookback?.lookbackWindowGames ?? TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_GAMES;
  const lookbackWindowDays = lookback?.lookbackWindowDays ?? TEAM_FORM_EVIDENCE_DEFAULT_LOOKBACK_DAYS;

  const targetTime = toMillis(target.scheduledStartTime);
  if (Number.isNaN(targetTime)) {
    return {
      lookbackWindowGames,
      lookbackWindowDays,
      awayRecentGamesFound: 0,
      homeRecentGamesFound: 0,
      awaySummary: {
        recentGamesFound: 0,
        summary: { status: 'insufficient', reason: 'invalid-target-scheduled-start-time' },
      },
      homeSummary: {
        recentGamesFound: 0,
        summary: { status: 'insufficient', reason: 'invalid-target-scheduled-start-time' },
      },
      dataQuality: 'insufficient',
      volatility: 'not-evaluated',
      confidence: 'low',
      warnings: [TEAM_FORM_EVIDENCE_INVALID_TARGET],
      evidence: [],
    };
  }

  const warnings = new Set<string>();
  const eligibleEvidence: TeamRecentFormEvidenceItem[] = [];
  let targetExcluded = false;
  let futureExcluded = false;
  let anyNoSafeCompletion = false;

  const anyRecordHasSafeCompletionPotential = historicalFixtures.some((record) => {
    const allPlays = record.liveData?.plays?.allPlays;
    if (!Array.isArray(allPlays) || allPlays.length === 0) {
      return false;
    }
    const lastPlay = allPlays[allPlays.length - 1];
    const endTime = typeof lastPlay?.about?.endTime === 'string'
      ? lastPlay.about.endTime.trim()
      : '';
    return endTime !== '' && record.provenance?.lastCompletedPlayEnd === 'LAST_COMPLETED_PLAY_END';
  });

  for (const record of historicalFixtures) {
    if (recordContainsPitcherFields(record)) {
      warnings.add(TEAM_FORM_EVIDENCE_PITCHER_FIELDS_EXCLUDED);
    }
    if (recordContainsForbiddenFields(record)) {
      warnings.add(TEAM_FORM_EVIDENCE_FORBIDDEN_FIELD_EXCLUDED);
    }

    const rawGameId = asNonEmptyString(
      typeof record.gameId === 'number' ? String(record.gameId) : record.gameId,
    );
    if (!rawGameId) {
      continue;
    }

    if (rawGameId === target.gameId) {
      targetExcluded = true;
      continue;
    }

    const officialDate = asNonEmptyString(record.officialDate) ?? '';
    const awayTeam = asNonEmptyString(record.awayTeam) ?? '';
    const homeTeam = asNonEmptyString(record.homeTeam) ?? '';
    const scheduledTime = asNonEmptyString(record.scheduledStartTime)
      ?? asNonEmptyString(record.gameDate)
      ?? '';

    let recordTime: number;
    if (scheduledTime) {
      recordTime = toMillis(scheduledTime);
    } else if (officialDate) {
      recordTime = toMillis(`${officialDate}T00:00:00Z`);
    } else {
      continue;
    }

    if (Number.isNaN(recordTime)) {
      continue;
    }

    if (recordTime >= targetTime) {
      futureExcluded = true;
      continue;
    }

    const teamRole: 'HOME' | 'AWAY' | null =
      awayTeam === target.awayTeam
        ? 'AWAY'
        : homeTeam === target.homeTeam
          ? 'HOME'
          : null;

    if (!teamRole) {
      continue;
    }

    const safeCompletion = getSafeCompletion(record);
    if (!safeCompletion) {
      anyNoSafeCompletion = true;
      continue;
    }

    const completedTime = toMillis(safeCompletion.completedAt);
    if (Number.isNaN(completedTime)) {
      anyNoSafeCompletion = true;
      continue;
    }

    if (completedTime >= targetTime) {
      futureExcluded = true;
      continue;
    }

    const daysDiff = (targetTime - completedTime) / (1000 * 60 * 60 * 24);
    if (daysDiff > lookbackWindowDays) {
      continue;
    }

    const opponent = teamRole === 'HOME' ? awayTeam : homeTeam;
    const teamName = teamRole === 'HOME' ? homeTeam : awayTeam;

    eligibleEvidence.push({
      sourceGameId: rawGameId,
      officialDate,
      completedAt: safeCompletion.completedAt,
      team: teamName,
      teamRole,
      opponent,
      sourceProvenance: safeCompletion.provenance,
    });
  }

  eligibleEvidence.sort((a, b) => {
    const aTime = toMillis(a.completedAt);
    const bTime = toMillis(b.completedAt);
    if (bTime !== aTime) {
      return bTime - aTime;
    }
    const aDate = toMillis(`${a.officialDate}T00:00:00Z`);
    const bDate = toMillis(`${b.officialDate}T00:00:00Z`);
    if (bDate !== aDate) {
      return bDate - aDate;
    }
    return a.sourceGameId < b.sourceGameId ? -1 : a.sourceGameId > b.sourceGameId ? 1 : 0;
  });

  const awayTruncated = eligibleEvidence
    .filter((item) => item.teamRole === 'AWAY')
    .slice(0, lookbackWindowGames);
  const homeTruncated = eligibleEvidence
    .filter((item) => item.teamRole === 'HOME')
    .slice(0, lookbackWindowGames);

  const awayRecentGamesFound = awayTruncated.length;
  const homeRecentGamesFound = homeTruncated.length;

  if (targetExcluded) {
    warnings.add(TEAM_FORM_EVIDENCE_TARGET_GAME_EXCLUDED);
  }
  if (futureExcluded) {
    warnings.add(TEAM_FORM_EVIDENCE_FUTURE_GAME_EXCLUDED);
  }
  if (awayRecentGamesFound === 0 && homeRecentGamesFound === 0 && anyNoSafeCompletion) {
    warnings.add(TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION);
  }
  if (!anyRecordHasSafeCompletionPotential) {
    warnings.add(TEAM_FORM_EVIDENCE_NO_SAFE_COMPLETION);
  }
  if (awayRecentGamesFound < lookbackWindowGames) {
    warnings.add(TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES);
  }
  if (homeRecentGamesFound < lookbackWindowGames) {
    warnings.add(TEAM_FORM_EVIDENCE_INSUFFICIENT_GAMES);
  }

  const truncatedSet = new Set(
    [...awayTruncated, ...homeTruncated].map(
      (item) => `${item.sourceGameId}:${item.completedAt}:${item.teamRole}`,
    ),
  );
  const evidence = eligibleEvidence.filter((item) =>
    truncatedSet.has(`${item.sourceGameId}:${item.completedAt}:${item.teamRole}`),
  );

  const dataQuality =
    awayRecentGamesFound === 0 && homeRecentGamesFound === 0
      ? 'insufficient'
      : awayRecentGamesFound >= lookbackWindowGames && homeRecentGamesFound >= lookbackWindowGames
        ? 'complete'
        : 'partial';

  const awayStatus: TeamRecentFormTeamEvidenceSummary['summary']['status'] =
    awayRecentGamesFound === 0
      ? 'insufficient'
      : awayRecentGamesFound < lookbackWindowGames
        ? 'partial'
        : 'complete';
  const homeStatus: TeamRecentFormTeamEvidenceSummary['summary']['status'] =
    homeRecentGamesFound === 0
      ? 'insufficient'
      : homeRecentGamesFound < lookbackWindowGames
        ? 'partial'
        : 'complete';

  const getReason = (status: TeamRecentFormTeamEvidenceSummary['summary']['status']): TeamRecentFormTeamEvidenceSummary['summary']['reason'] => {
    switch (status) {
      case 'complete':
        return 'complete-evidence';
      case 'partial':
        return 'partial-evidence';
      case 'insufficient':
        return 'insufficient-evidence';
      default:
        return 'not-evaluated';
    }
  };

  return {
    lookbackWindowGames,
    lookbackWindowDays,
    awayRecentGamesFound,
    homeRecentGamesFound,
    awaySummary: { recentGamesFound: awayRecentGamesFound, summary: { status: awayStatus, reason: getReason(awayStatus) } },
    homeSummary: { recentGamesFound: homeRecentGamesFound, summary: { status: homeStatus, reason: getReason(homeStatus) } },
    dataQuality,
    volatility: 'not-evaluated',
    confidence: dataQuality === 'complete' ? 'high' : dataQuality === 'partial' ? 'medium' : 'low',
    warnings: [...warnings].sort(),
    evidence,
  };
}
