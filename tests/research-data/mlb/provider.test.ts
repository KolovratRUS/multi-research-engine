import { describe, it, expect } from 'vitest';
import { MLBFixtureProvider } from '@/lib/research-data/mlb/fixture-provider';
import type { PitcherAssignment } from '@/lib/research-data/types';

describe('MLBFixtureProvider', () => {
  const provider = new MLBFixtureProvider();

  it('returns a deterministic schedule from fixture', async () => {
    const result = await provider.fetchSchedule('2026-06-26');
    expect(result.games).toHaveLength(1);
    expect(result.games[0].gamePk).toBe(100001);
    expect(result.games[0].awayTeamName).toBe('Fixture Team Alpha');
    expect(result.games[0].homeTeamName).toBe('Fixture Team Beta');
    expect(result.games[0].awayTeamId).toBe(100101);
    expect(result.games[0].homeTeamId).toBe(100102);
  });

  it('returns deterministic probable pitchers', async () => {
    const result = await provider.fetchProbablePitchers(100001);
    const home = result.home as Extract<PitcherAssignment, { availability: 'AVAILABLE' }>;
    expect(home.fullName).toBe('Fixture Pitcher Beta');
    expect(home.teamId).toBe(100102);
    const away = result.away as Extract<PitcherAssignment, { availability: 'AVAILABLE' }>;
    expect(away.fullName).toBe('Fixture Pitcher Alpha');
    expect(away.teamId).toBe(100101);
  });

  it('returns pitcher season stats cast to typed result', async () => {
    const result = await provider.fetchPitcherSeasonStats(100201, 2026);
    expect(result.stats).not.toBeNull();
    expect(result.stats?.strikeOuts).toBe(85);
    expect(result.stats?.era).toBe('3.00');
    expect(result.provenance.isLive).toBe(false);
  });

  it('returns pitcher recent starts with fictional opponents', async () => {
    const result = await provider.fetchPitcherRecentStarts(100201, 2026, 3);
    expect(result.starts).toHaveLength(3);
    expect(result.starts[0].opponent).toBe('Fixture Opponent X');
    expect(result.starts[1].opponent).toBe('Fixture Opponent Y');
    expect(result.starts[2].opponent).toBe('Fixture Opponent Z');
  });

  it('returns team batting statistics', async () => {
    const result = await provider.fetchTeamBattingStats(100101, 2026);
    expect(result.stats).not.toBeNull();
    expect(result.provenance.isLive).toBe(false);
  });

  it('returns team pitching statistics', async () => {
    const result = await provider.fetchTeamPitchingStats(100101, 2026);
    expect(result.stats).not.toBeNull();
    expect(result.provenance.isLive).toBe(false);
  });

  it('returns venue data and enforces roof type', async () => {
    const result = await provider.fetchVenue(1001);
    expect(result.id).toBe(1001);
    expect(result.roofType).toBe('OPEN');
    expect(result.warnings).toHaveLength(0);
  });
});
