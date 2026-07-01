import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MLBResearchDataAdapter } from '@/lib/research-data/mlb/provider';
import type { MLBResearchDataProvider, PitcherAssignment } from '@/lib/research-data/types';

const baseGame = {
  gamePk: 900001,
  officialDate: '2026-06-26',
  gameDate: '2026-06-26T22:10:00Z',
  startTimeUtc: new Date('2026-06-26T22:10:00Z'),
  status: 'UPCOMING',
  homeTeamId: 1001,
  homeTeamName: 'Home',
  awayTeamId: 1002,
  awayTeamName: 'Away',
  venueId: 1001,
  venueName: 'Fixture Stadium',
  dayNight: 'day',
  scheduledInnings: 9,
  doubleHeader: 'N',
  seriesGameNumber: 1,
  gamesInSeries: 1,
  seriesDescription: 'Regular',
  leagueRecord: {
    home: { wins: 0, losses: 0, pct: '.000' },
    away: { wins: 0, losses: 0, pct: '.000' },
  },
  probablePitchers: { home: null, away: null },
};

function availablePitcher(overrides: Partial<PitcherAssignment> = {}): Extract<PitcherAssignment, { availability: 'AVAILABLE' }> {
  return {
    availability: 'AVAILABLE',
    personId: 0,
    fullName: 'Fixture',
    teamId: 0,
    status: 'PROBABLE',
    fetchedAt: new Date(),
    warnings: [],
    ...overrides,
  } as Extract<PitcherAssignment, { availability: 'AVAILABLE' }>;
}

function createMockProvider(overrides: {
  fetchSchedule?: any;
  fetchProbablePitchers?: any;
  fetchPitcherSeasonStats?: any;
  fetchPitcherRecentStarts?: any;
  fetchTeamBattingStats?: any;
  fetchTeamPitchingStats?: any;
  fetchVenue?: any;
} = {}): MLBResearchDataProvider {
  return {
    fetchSchedule: overrides.fetchSchedule ?? vi.fn().mockResolvedValue({
      games: [baseGame],
      provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
    }),
    fetchProbablePitchers: overrides.fetchProbablePitchers ?? vi.fn(),
    fetchPitcherSeasonStats: overrides.fetchPitcherSeasonStats ?? vi.fn().mockResolvedValue({
      personId: 1,
      season: 2026,
      stats: null,
      provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
    }),
    fetchPitcherRecentStarts: overrides.fetchPitcherRecentStarts ?? vi.fn().mockResolvedValue({
      personId: 1,
      season: 2026,
      starts: [],
      provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
    }),
    fetchTeamBattingStats: overrides.fetchTeamBattingStats ?? vi.fn().mockResolvedValue({
      teamId: 1001,
      season: 2026,
      stats: null,
      provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
    }),
    fetchTeamPitchingStats: overrides.fetchTeamPitchingStats ?? vi.fn().mockResolvedValue({
      teamId: 1001,
      season: 2026,
      stats: null,
      provenance: { source: 'test', fetchedAt: new Date(), isLive: false, warnings: [] },
    }),
    fetchVenue: overrides.fetchVenue ?? vi.fn().mockResolvedValue({
      id: 1001,
      name: 'Fixture Stadium',
      roofType: 'OPEN',
      warnings: [],
    }),
  };
}

describe('Probable pitcher precedence and optional game feed', () => {
  it('uses schedule pitchers when feed is unavailable', async () => {
    const scheduleHome = availablePitcher({ personId: 100101, fullName: 'Fixture Pitcher Home', teamId: 1001 });
    const scheduleAway = availablePitcher({ personId: 100102, fullName: 'Fixture Pitcher Away', teamId: 1002 });

    const provider = createMockProvider({
      fetchProbablePitchers: vi.fn().mockRejectedValue(new Error('404 Not Found')),
    });

    const adapter = new MLBResearchDataAdapter({ client: provider as any });
    const result = await adapter.fetchProbablePitchers(900001, {
      home: scheduleHome,
      away: scheduleAway,
    });

    expect(result.home?.availability).toBe('AVAILABLE');
    expect((result.home as Extract<PitcherAssignment, { availability: 'AVAILABLE' }>).fullName).toBe('Fixture Pitcher Home');
    expect(result.away?.availability).toBe('AVAILABLE');
    expect((result.away as Extract<PitcherAssignment, { availability: 'AVAILABLE' }>).fullName).toBe('Fixture Pitcher Away');
    expect(result.provenance.warnings.some((w) => w.includes('Game feed unavailable'))).toBe(true);
  });

  it('prefers explicit feed assignment over schedule when present', async () => {
    const scheduleHome = availablePitcher({ personId: 100101, fullName: 'Fixture Pitcher Home', teamId: 1001 });
    const scheduleAway = availablePitcher({ personId: 100102, fullName: 'Fixture Pitcher Away', teamId: 1002 });

    const provider = createMockProvider({
      fetchProbablePitchers: vi.fn().mockResolvedValue({
        gameData: {
          probablePitchers: {
            home: { id: 100199, fullName: 'Feed Pitcher Home' },
            away: { id: 100198, fullName: 'Feed Pitcher Away' },
          },
          teams: { home: { id: 1001 }, away: { id: 1002 } },
        },
      }),
    });

    const adapter = new MLBResearchDataAdapter({ client: provider as any });
    const result = await adapter.fetchProbablePitchers(900001, {
      home: scheduleHome,
      away: scheduleAway,
    });

    expect(result.home?.availability).toBe('AVAILABLE');
    expect((result.home as Extract<PitcherAssignment, { availability: 'AVAILABLE' }>).fullName).toBe('Feed Pitcher Home');
    expect(result.away?.availability).toBe('AVAILABLE');
    expect((result.away as Extract<PitcherAssignment, { availability: 'AVAILABLE' }>).fullName).toBe('Feed Pitcher Away');
    expect(result.provenance.warnings).toHaveLength(0);
  });

  it('marks differing feed pitchers as CHANGED', async () => {
    const scheduleHome = availablePitcher({ personId: 100101, fullName: 'Fixture Pitcher Home', teamId: 1001 });
    const scheduleAway = null;

    const provider = createMockProvider({
      fetchProbablePitchers: vi.fn().mockResolvedValue({
        gameData: {
          probablePitchers: {
            home: { id: 100199, fullName: 'Feed Pitcher Home' },
            away: { id: 100198, fullName: 'Feed Pitcher Away' },
          },
          teams: { home: { id: 1001 }, away: { id: 1002 } },
        },
      }),
    });

    const adapter = new MLBResearchDataAdapter({ client: provider as any });
    const result = await adapter.fetchProbablePitchers(900001, {
      home: scheduleHome,
      away: scheduleAway,
    });

    expect(result.home?.status).toBe('CHANGED');
    expect(result.away?.status).toBe('PROBABLE');
  });

  it('produces UNAVAILABLE when neither schedule nor feed provides pitchers', async () => {
    const provider = createMockProvider({
      fetchProbablePitchers: vi.fn().mockResolvedValue({
        gameData: {
          probablePitchers: {},
          teams: { home: { id: 1001 }, away: { id: 1002 } },
        },
      }),
    });

    const adapter = new MLBResearchDataAdapter({ client: provider as any });
    const result = await adapter.fetchProbablePitchers(900001);

    expect(result.home?.status).toBe('UNAVAILABLE');
    expect(result.away?.status).toBe('UNAVAILABLE');
    expect(result.provenance.warnings.some((w) => w.includes('absent from schedule and game feed'))).toBe(true);
  });

  it('does not fall back to fixture providers on live failure', async () => {
    const liveProvider = createMockProvider({
      fetchSchedule: vi.fn().mockResolvedValue({
        games: [baseGame],
        provenance: { source: 'test', fetchedAt: new Date(), isLive: true, warnings: [] },
      }),
      fetchProbablePitchers: vi.fn().mockRejectedValue(new Error('MLB Stats API request failed')),
    });

    const adapter = new MLBResearchDataAdapter({ client: liveProvider as any });
    const result = await adapter.fetchProbablePitchers(900001, {
      home: null,
      away: null,
      homeTeamId: baseGame.homeTeamId,
      awayTeamId: baseGame.awayTeamId,
    });

    expect(result.home?.status).toBe('UNAVAILABLE');
    expect(result.away?.status).toBe('UNAVAILABLE');
    expect(result.provenance.warnings.some((w) => w.includes('Game feed unavailable'))).toBe(true);
  });
});
