export type EventStatus = 'UPCOMING' | 'LIVE' | 'FINAL';

export interface NormalizedProviderEvent {
  externalId: string;
  sport: string;
  league: string;
  leagueSlug?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamSlug?: string;
  awayTeamSlug?: string;
  startTimeUtc: Date;
  status: EventStatus;
  homeScore?: number;
  awayScore?: number;
}

export interface CanonicalEvent {
  id: string;
  externalId: string;
  sport: string;
  league: string;
  leagueSlug?: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamSlug?: string;
  awayTeamSlug?: string;
  startTimeUtc: Date;
  status: EventStatus;
  homeScore?: number;
  awayScore?: number;
  createdAt: Date;
  updatedAt: Date;
}
