import { describe, it, expect } from 'vitest';
import { normalizeEvent, normalizeStatus } from '@/lib/odds/normalization/events';
import { normalizeMarketKey, normalizeSelection } from '@/lib/odds/normalization/markets';
import { canonicalizeBookmaker, isSportsbetAvailable } from '@/lib/odds/normalization/bookmakers';

describe('odds normalization', () => {
  it('normalizes event status', () => {
    expect(normalizeStatus('IN_PROGRESS')).toBe('LIVE');
    expect(normalizeStatus('ENDED')).toBe('FINAL');
    expect(normalizeStatus('UPCOMING')).toBe('UPCOMING');
  });

  it('normalizes market keys', () => {
    expect(normalizeMarketKey('h2h')).toBe('H2H');
    expect(normalizeMarketKey('moneyline')).toBe('H2H');
    expect(normalizeMarketKey('spreads')).toBe('SPREADS');
    expect(normalizeMarketKey('total_points')).toBe('TOTALS');
  });

  it('normalizes bookmaker names', () => {
    expect(canonicalizeBookmaker('Sportsbet')).toBe('SPORTSBET');
    expect(canonicalizeBookmaker('Ladbrokes')).toBe('LADBROKES');
    expect(canonicalizeBookmaker('UnknownBook')).toBe('OTHER');
  });

  it('detects Sportsbet availability', () => {
    expect(isSportsbetAvailable(['SPORTSBET', 'LADBROKES'])).toBe(true);
    expect(isSportsbetAvailable(['LADBROKES'])).toBe(false);
  });

  it('normalizes event with fallbacks', () => {
    const raw = {
      externalId: 'event-1',
      sport: 'mlb',
      league: 'MLB',
      homeTeam: 'Yankees',
      awayTeam: 'Red Sox',
      startTimeUtc: '2026-07-01T23:05:00Z',
      status: 'UPCOMING',
    };
    const event = normalizeEvent(raw);
    expect(event.externalId).toBe('event-1');
    expect(event.homeTeam).toBe('Yankees');
    expect(event.startTimeUtc).toBeInstanceOf(Date);
  });
});
