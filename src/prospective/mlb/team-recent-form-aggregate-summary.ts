import type {
  TeamRecentFormEvidenceItem,
  TeamRecentFormFixtureEvidenceResult,
} from './team-recent-form-fixture-evidence';

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
  const completedGamesConsidered = gamesConsidered;
  const homeAwaySplitCounts = countHomeAway(evidenceItems);
  const opponentSet = new Set(teamItems.map((item) => item.opponent));
  const dataCompletenessLabel =
    gamesConsidered === 0
      ? 'insufficient'
      : gamesConsidered < lookbackWindowGames
        ? 'partial'
        : 'complete';
  const recencyCoverageLabel = dataCompletenessLabel;
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
    completedGamesConsidered,
    recencyWindowDays: lookbackWindowDays,
    recencyWindowGames: lookbackWindowGames,
    homeAwaySplitCounts,
    opponentDiversityCount: opponentSet.size,
    dataCompletenessLabel,
    recencyCoverageLabel,
    sourceCompletenessWarnings,
  };
}

export function buildMLBTeamRecentFormAggregateSummary(
  fixtureEvidence: TeamRecentFormFixtureEvidenceResult,
): {
  readonly awayAggregateSummary: MLBTeamRecentFormAggregateSummary;
  readonly homeAggregateSummary: MLBTeamRecentFormAggregateSummary;
} {
  const evidenceItems = fixtureEvidence.evidence;
  const lookbackWindowDays = fixtureEvidence.lookbackWindowDays;
  const lookbackWindowGames = fixtureEvidence.lookbackWindowGames;
  const sourceCompletenessWarnings = [...fixtureEvidence.warnings].sort();

  return {
    awayAggregateSummary: buildTeamAggregateSummary('AWAY', evidenceItems, lookbackWindowDays, lookbackWindowGames, sourceCompletenessWarnings),
    homeAggregateSummary: buildTeamAggregateSummary('HOME', evidenceItems, lookbackWindowDays, lookbackWindowGames, sourceCompletenessWarnings),
  };
}
