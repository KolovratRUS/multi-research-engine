import { describe, it, expect } from 'vitest';
import { MLBResearchDataAdapter } from '@/lib/research-data/mlb/provider';
import type { MLBResearchDataProvider, MLBVenue } from '@/lib/research-data/types';

describe('Unknown venue weather bypass', () => {
  it('does not call weather provider for unknown venue', async () => {
    let weatherCalled = false;

    const mockProvider: MLBResearchDataProvider = {
      fetchSchedule: async () => ({
        games: [
          {
            gamePk: 999999,
            gameType: 'R',
            gameNumber: 1,
            officialDate: '2026-06-26',
            gameDate: '2026-06-26T22:10:00Z',
            startTimeUtc: new Date('2026-06-26T22:10:00Z'),
            status: 'UPCOMING',
            homeTeamId: 1001,
            homeTeamName: 'Home',
            awayTeamId: 1002,
            awayTeamName: 'Away',
            venueId: 999999,
            venueName: 'Unknown Stadium',
            dayNight: 'day',
            scheduledInnings: 9,
            doubleHeader: 'N',
            seriesGameNumber: 1,
            gamesInSeries: 1,
            seriesDescription: 'Regular',
            leagueRecord: { home: { wins: 0, losses: 0, pct: '.000' }, away: { wins: 0, losses: 0, pct: '.000' } },
            probablePitchers: { home: null, away: null },
          },
        ],
        provenance: {
          source: 'test',
          fetchedAt: new Date(),
          isLive: false,
          warnings: [],
        },
      }),
      fetchProbablePitchers: async () => ({
        gamePk: 999999,
        home: null,
        away: null,
        provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
      }),
      fetchPitcherSeasonStats: async () => ({
        personId: 1,
        season: 2026,
        stats: null,
        provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
      }),
      fetchPitcherRecentStarts: async () => ({
        personId: 1,
        season: 2026,
        starts: [],
        provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
      }),
      fetchTeamBattingStats: async () => ({
        teamId: 1,
        season: 2026,
        stats: null,
        provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
      }),
      fetchTeamPitchingStats: async () => ({
        teamId: 1,
        season: 2026,
        stats: null,
        provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
      }),
      fetchVenue: async () => ({
        id: 999999,
        name: 'Unknown Stadium',
        roofType: 'UNKNOWN',
        warnings: ['Venue 999999 not found in stadium registry.'],
      }),
    };

    const adapter = new MLBResearchDataAdapter({ client: mockProvider as any });
    const snapshot = await adapter.buildGameSnapshot(
      {
        gamePk: 999999,
        gameType: 'R',
        gameNumber: 1,
        officialDate: '2026-06-26',
        gameDate: '2026-06-26T22:10:00Z',
        startTimeUtc: new Date('2026-06-26T22:10:00Z'),
        status: 'UPCOMING',
        homeTeamId: 1001,
        homeTeamName: 'Home',
        awayTeamId: 1002,
        awayTeamName: 'Away',
        venueId: 999999,
        venueName: 'Unknown Stadium',
        dayNight: 'day',
        scheduledInnings: 9,
        doubleHeader: 'N',
        seriesGameNumber: 1,
        gamesInSeries: 1,
        seriesDescription: 'Regular',
        leagueRecord: { home: { wins: 0, losses: 0, pct: '.000' }, away: { wins: 0, losses: 0, pct: '.000' } },
        probablePitchers: { home: null, away: null },
      },
      {
        season: 2026,
        includeWeather: true,
        weatherProvider: {
          fetchGameWeather: async () => {
            weatherCalled = true;
            return {
              temperatureC: 20,
              precipitationProbability: 0,
              precipitationMm: 0,
              windSpeedKmh: 10,
              windDirectionDeg: 180,
              humidityPercent: 50,
              matchedHourUtc: '2026-06-26T22:00:00Z',
              rawTimestamp: new Date().toISOString(),
              freshness: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
            };
          },
        },
      },
    );

    expect(weatherCalled).toBe(false);
    expect(snapshot.weather).toBeNull();
    expect(snapshot.warnings).toContain('Weather unavailable: missing coordinates or unknown roof type.');
    expect((snapshot.venue as MLBVenue).roofType).toBe('UNKNOWN');
    expect((snapshot.venue as MLBVenue).warnings).toContain('Venue 999999 not found in stadium registry.');
  });
});
