import type { NormalizedProviderEvent } from '@/types/event';

export function normalizeEvent(raw: Record<string, unknown>): NormalizedProviderEvent {
  const startSource = raw.startTimeUtc ?? raw.start_time ?? raw.commence_time;
  let startTimeUtc: Date;
  const startValue = startSource as string | number | Date | undefined;
  if (startValue instanceof Date) {
    startTimeUtc = startValue;
  } else if (typeof startValue === 'string' || typeof startValue === 'number') {
    startTimeUtc = new Date(startValue);
  } else {
    startTimeUtc = new Date();
  }

  return {
    externalId: String(raw.externalId ?? raw.id ?? ''),
    sport: String(raw.sport ?? ''),
    league: String(raw.league ?? raw.competition ?? ''),
    leagueSlug: typeof raw.leagueSlug === 'string' ? raw.leagueSlug : undefined,
    homeTeam: String(raw.homeTeam ?? raw.home_team ?? ''),
    awayTeam: String(raw.awayTeam ?? raw.away_team ?? ''),
    homeTeamSlug: typeof raw.homeTeamSlug === 'string' ? raw.homeTeamSlug : undefined,
    awayTeamSlug: typeof raw.awayTeamSlug === 'string' ? raw.awayTeamSlug : undefined,
    startTimeUtc,
    status: normalizeStatus(raw.status ?? raw.match_status),
    homeScore: raw.homeScore !== undefined ? Number(raw.homeScore) : undefined,
    awayScore: raw.awayScore !== undefined ? Number(raw.awayScore) : undefined,
  };
}

export function normalizeStatus(raw: unknown): NormalizedProviderEvent['status'] {
  const value = String(raw ?? 'UPCOMING').toUpperCase();
  if (value === 'LIVE' || value === 'IN_PROGRESS' || value === 'INPLAY') return 'LIVE';
  if (value === 'FINAL' || value === 'ENDED' || value === 'COMPLETE') return 'FINAL';
  return 'UPCOMING';
}
