import type {
  TeamRecentFormEvidenceItem,
  TeamRecentFormFixtureEvidenceResult,
  TeamRecentFormEvidenceRecord,
} from './team-recent-form-fixture-evidence';

export const TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED =
  'TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED';
export const TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_REQUIRES_AGGREGATE_SUMMARIES =
  'TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_REQUIRES_AGGREGATE_SUMMARIES';

export interface MLBTeamRecentFormAggregateSummary {
  readonly status: 'not-evaluated' | 'complete' | 'partial' | 'insufficient';
  readonly reason: 'not-evaluated' | 'no-evidence' | 'insufficient-evidence' | 'partial-evidence' | 'complete-evidence';
  readonly gamesConsidered: number;
  readonly completedGamesConsidered: number;
  readonly recencyWindowDays: number;
  readonly recencyWindowGames: number;
  readonly homeAwaySplitCounts: { readonly home: number; readonly away: number };
  readonly opponentDiversityCount: number;
  readonly dataCompletenessLabel: 'complete' | 'partial' | 'insufficient';
  readonly recencyCoverageLabel: 'complete' | 'partial' | 'insufficient';
  readonly sourceCompletenessWarnings: readonly string[];
  resultAggregateMetrics?: MLBTeamRecentFormResultAggregateMetrics;
}

export interface MLBTeamRecentFormResultAggregateMetrics {
  readonly status: 'not-evaluated' | 'insufficient' | 'complete' | 'partial';
  readonly reason: 'not-evaluated' | 'insufficient-result-evidence' | 'complete-evidence' | 'partial-evidence';
  readonly gamesWithResultMetrics: number;
  readonly winsCount: number;
  readonly lossesCount: number;
  readonly drawsOrTiesCount: number;
  readonly averageRunsFor: number | null;
  readonly averageRunsAgainst: number | null;
  readonly averageRunDifferential: number | null;
  readonly runDifferentialTotal: number;
  readonly gamesWithRunsForAvailable: number;
  readonly gamesWithRunsAgainstAvailable: number;
  readonly resultMetricCompletenessLabel: 'complete' | 'partial' | 'insufficient';
  readonly resultMetricWarnings: readonly string[];
}

function countHomeAway(items: readonly TeamRecentFormEvidenceItem[]): { readonly home: number; readonly away: number } {
  let home = 0;
  let away = 0;
  for (const item of items) {
    if (item.teamRole === 'HOME') {
      home += 1;
    } else if (item.teamRole === 'AWAY') {
      away += 1;
    }
  }
  return { home, away };
}

function buildTeamAggregateSummary(
  teamRole: 'HOME' | 'AWAY',
  evidenceItems: readonly TeamRecentFormEvidenceItem[],
  lookbackWindowDays: number,
  lookbackWindowGames: number,
  sourceCompletenessWarnings: readonly string[],
): MLBTeamRecentFormAggregateSummary {
  const teamItems = evidenceItems.filter((item) => item.teamRole === teamRole);
  const gamesConsidered = teamItems.length;
  const homeAwaySplitCounts = countHomeAway(evidenceItems);
  const opponentSet = new Set(teamItems.map((item) => item.opponent));
  const dataCompletenessLabel =
    gamesConsidered === 0
      ? 'insufficient'
      : gamesConsidered < lookbackWindowGames
        ? 'partial'
        : 'complete';
  const status = dataCompletenessLabel;
  const reason =
    status === 'complete'
      ? 'complete-evidence'
      : status === 'partial'
        ? 'partial-evidence'
        : 'insufficient-evidence';

  return {
    status,
    reason,
    gamesConsidered,
    completedGamesConsidered: gamesConsidered,
    recencyWindowDays: lookbackWindowDays,
    recencyWindowGames: lookbackWindowGames,
    homeAwaySplitCounts,
    opponentDiversityCount: opponentSet.size,
    dataCompletenessLabel,
    recencyCoverageLabel: dataCompletenessLabel,
    sourceCompletenessWarnings,
  };
}

function toMillis(input: string): number {
  const millis = new Date(input).getTime();
  if (Number.isNaN(millis)) {
    return NaN;
  }
  return millis;
}

interface TeamResultItem {
  readonly sourceGameId: string;
  readonly officialDate: string;
  readonly completedAt: string;
  readonly team: string;
  readonly teamRole: 'HOME' | 'AWAY';
  readonly opponent: string;
  readonly sourceProvenance: string;
  readonly runsFor: number | null;
  readonly runsAgainst: number | null;
  readonly runDifferential: number | null;
}

function buildTeamResultAggregateMetrics(
  teamRole: 'HOME' | 'AWAY',
  eligibleSafeCompletedResults: readonly TeamResultItem[],
  lookbackWindowGames: number,
  sourceCompletenessWarnings: readonly string[],
): MLBTeamRecentFormResultAggregateMetrics {
  const teamResultItems = eligibleSafeCompletedResults.filter(
    (item) => item.teamRole === teamRole,
  );

  const gamesWithResultMetrics = teamResultItems.filter(
    (item) => item.runsFor !== null && item.runsAgainst !== null,
  ).length;

  let winsCount = 0;
  let lossesCount = 0;
  let drawsOrTiesCount = 0;
  let runsForSum = 0;
  let runsAgainstSum = 0;
  let runDifferentialSum = 0;
  let gamesWithRunsForAvailable = 0;
  let gamesWithRunsAgainstAvailable = 0;

  for (const item of teamResultItems) {
    if (item.runsFor !== null) {
      runsForSum += item.runsFor;
      gamesWithRunsForAvailable += 1;
    }
    if (item.runsAgainst !== null) {
      runsAgainstSum += item.runsAgainst;
      gamesWithRunsAgainstAvailable += 1;
    }
    if (item.runsFor !== null && item.runsAgainst !== null) {
      runDifferentialSum += item.runsFor - item.runsAgainst;
      if (item.runsFor > item.runsAgainst) {
        winsCount += 1;
      } else if (item.runsFor < item.runsAgainst) {
        lossesCount += 1;
      } else {
        drawsOrTiesCount += 1;
      }
    }
  }

  const sampleSize = gamesWithResultMetrics;
  const averageRunsFor = sampleSize === 0 ? null : parseFloat((runsForSum / sampleSize).toFixed(4));
  const averageRunsAgainst = sampleSize === 0 ? null : parseFloat((runsAgainstSum / sampleSize).toFixed(4));
  const averageRunDifferential = sampleSize === 0 ? null : parseFloat((runDifferentialSum / sampleSize).toFixed(4));

  const resultMetricCompletenessLabel =
    gamesWithResultMetrics === 0
      ? 'insufficient'
      : gamesWithResultMetrics < lookbackWindowGames
        ? 'partial'
        : 'complete';

  const status = resultMetricCompletenessLabel;
  const reason =
    status === 'complete'
      ? 'complete-evidence'
      : status === 'partial'
        ? 'partial-evidence'
        : 'insufficient-result-evidence';

  return {
    status,
    reason,
    gamesWithResultMetrics,
    winsCount,
    lossesCount,
    drawsOrTiesCount,
    averageRunsFor,
    averageRunsAgainst,
    averageRunDifferential,
    runDifferentialTotal: runDifferentialSum,
    gamesWithRunsForAvailable,
    gamesWithRunsAgainstAvailable,
    resultMetricCompletenessLabel,
    resultMetricWarnings: sourceCompletenessWarnings,
  };
}

export function extractEligibleSafeCompletedResultsFromEvidence(
  evidence: readonly TeamRecentFormEvidenceItem[],
): readonly TeamResultItem[] {
  return evidence.map((item) => ({
    sourceGameId: item.sourceGameId,
    officialDate: item.officialDate,
    completedAt: item.completedAt,
    team: item.team,
    teamRole: item.teamRole,
    opponent: item.opponent,
    sourceProvenance: item.sourceProvenance,
    runsFor: null,
    runsAgainst: null,
    runDifferential: null,
  }));
}

export function buildSafeResultItemsFromManualRecords<
  T extends {
    readonly gameId: string;
    readonly scheduledStartTime: string;
    readonly awayTeam: string;
    readonly homeTeam: string;
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
    readonly safeResultData?: Readonly<{
      readonly awayScore?: number;
      readonly homeScore?: number;
    }> | null;
  }>({
    records,
    target,
    lookbackWindowDays,
    lookbackWindowGames,
  }: {
    readonly records: readonly T[];
    readonly target: {
      readonly gameId: string;
      readonly scheduledStartTime: string;
      readonly awayTeam: string;
      readonly homeTeam: string;
    };
    readonly lookbackWindowDays: number;
    readonly lookbackWindowGames: number;
  }): readonly TeamResultItem[] {
  const targetTime = toMillis(target.scheduledStartTime);
  const eligible: TeamResultItem[] = [];

  for (const record of records) {
    const rawGameId =
      typeof record.gameId === 'number' ? String(record.gameId) : record.gameId;
    if (!rawGameId || rawGameId === target.gameId) {
      continue;
    }

    const scheduledTime = toMillis(record.scheduledStartTime);
    if (Number.isNaN(scheduledTime)) {
      continue;
    }
    if (scheduledTime >= targetTime) {
      continue;
    }

    const awayTeam = record.awayTeam ?? '';
    const homeTeam = record.homeTeam ?? '';
    const teamRole: 'HOME' | 'AWAY' | null =
      awayTeam === target.awayTeam
        ? 'AWAY'
        : homeTeam === target.homeTeam
          ? 'HOME'
          : null;
    if (!teamRole) {
      continue;
    }

    const allPlays = record.liveData?.plays?.allPlays;
    if (!Array.isArray(allPlays) || allPlays.length === 0) {
      continue;
    }
    const lastPlay = allPlays[allPlays.length - 1];
    const endTime = typeof lastPlay?.about?.endTime === 'string'
      ? lastPlay.about.endTime.trim()
      : '';
    if (endTime === '' || record.provenance?.lastCompletedPlayEnd !== 'LAST_COMPLETED_PLAY_END') {
      continue;
    }

    const completedTime = toMillis(endTime);
    if (Number.isNaN(completedTime) || completedTime >= targetTime) {
      continue;
    }

    const daysDiff = (targetTime - completedTime) / (1000 * 60 * 60 * 24);
    if (daysDiff > lookbackWindowDays) {
      continue;
    }

    const rawResult = record.safeResultData;
    const awayScore = typeof rawResult?.awayScore === 'number'
      ? rawResult.awayScore
      : null;
    const homeScore = typeof rawResult?.homeScore === 'number'
      ? rawResult.homeScore
      : null;

    if (awayScore === null || homeScore === null) {
      continue;
    }

    const runsFor = teamRole === 'HOME' ? homeScore : awayScore;
    const runsAgainst = teamRole === 'HOME' ? awayScore : homeScore;
    const runDifferential = runsFor - runsAgainst;

    const opponent = teamRole === 'HOME' ? awayTeam : homeTeam;
    const teamName = teamRole === 'HOME' ? homeTeam : awayTeam;

    eligible.push({
      sourceGameId: rawGameId,
      officialDate: '',
      completedAt: endTime,
      team: teamName,
      teamRole,
      opponent,
      sourceProvenance: 'LAST_COMPLETED_PLAY_END',
      runsFor,
      runsAgainst,
      runDifferential,
    });
  }

  eligible.sort((a, b) => {
    const aTime = toMillis(a.completedAt);
    const bTime = toMillis(b.completedAt);
    if (bTime !== aTime) {
      return bTime - aTime;
    }
    return a.sourceGameId < b.sourceGameId ? -1 : a.sourceGameId > b.sourceGameId ? 1 : 0;
  });

  return eligible.slice(0, lookbackWindowGames);
}

function buildTeamResultAggregateMetricsForSummary(
  teamRole: 'HOME' | 'AWAY',
  eligibleSafeCompletedResults: readonly TeamResultItem[],
  lookbackWindowGames: number,
  sourceCompletenessWarnings: readonly string[],
): MLBTeamRecentFormResultAggregateMetrics {
  const warnings = [...sourceCompletenessWarnings];
  if (eligibleSafeCompletedResults.length === 0) {
    warnings.push(TEAM_FORM_RESEARCH_RESULT_AGGREGATE_METRICS_NOT_ENABLED);
  }
  return buildTeamResultAggregateMetrics(teamRole, eligibleSafeCompletedResults, lookbackWindowGames, warnings);
}

export function buildMLBTeamRecentFormAggregateSummary(
  fixtureEvidence: TeamRecentFormFixtureEvidenceResult,
  resultAggregateMetricsEnabled?: boolean,
  eligibleSafeCompletedResults?: readonly TeamResultItem[],
): {
  awayAggregateSummary: MLBTeamRecentFormAggregateSummary;
  homeAggregateSummary: MLBTeamRecentFormAggregateSummary;
} {
  const evidenceItems = fixtureEvidence.evidence;
  const lookbackWindowDays = fixtureEvidence.lookbackWindowDays;
  const lookbackWindowGames = fixtureEvidence.lookbackWindowGames;
  const sourceCompletenessWarnings = [...fixtureEvidence.warnings].sort();

  const away = buildTeamAggregateSummary('AWAY', evidenceItems, lookbackWindowDays, lookbackWindowGames, sourceCompletenessWarnings);
  const home = buildTeamAggregateSummary('HOME', evidenceItems, lookbackWindowDays, lookbackWindowGames, sourceCompletenessWarnings);

  if (resultAggregateMetricsEnabled && eligibleSafeCompletedResults) {
    away.resultAggregateMetrics = buildTeamResultAggregateMetricsForSummary('AWAY', eligibleSafeCompletedResults, lookbackWindowGames, sourceCompletenessWarnings);
    home.resultAggregateMetrics = buildTeamResultAggregateMetricsForSummary('HOME', eligibleSafeCompletedResults, lookbackWindowGames, sourceCompletenessWarnings);
  }

  return { awayAggregateSummary: away, homeAggregateSummary: home };
}
