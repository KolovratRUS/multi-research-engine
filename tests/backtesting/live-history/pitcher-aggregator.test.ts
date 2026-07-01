import { describe, it, expect } from 'vitest';
import { parseBaseballInnings, formatOutsAsInnings, aggregatePitcherHistory } from '@/lib/backtesting/mlb/live-history/pitcher-aggregator';
import type { HistoricalPitcherAppearance } from '@/lib/backtesting/mlb/live-history/types';

function appearance(params: Partial<HistoricalPitcherAppearance> = {}): HistoricalPitcherAppearance {
  return {
    gamePk: 0,
    gameStart: new Date('2024-06-10T19:00:00Z'),
    completedAt: new Date('2024-06-01T21:30:00Z'),
    completedAtSource: 'LAST_COMPLETED_PLAY_END',
    status: 'FINAL',
    personId: 1,
    teamId: 1,
    started: false,
    inningsPitched: '0.0',
    earnedRuns: 0,
    hitsAllowed: 0,
    walks: 0,
    strikeouts: 0,
    homeRunsAllowed: 0,
    pitches: null,
    ...params,
  };
}

describe('parseBaseballInnings', () => {
  it('parses valid innings formats', () => {
    expect(parseBaseballInnings('0')).toBeCloseTo(0);
    expect(parseBaseballInnings('0.0')).toBeCloseTo(0);
    expect(parseBaseballInnings('0.1')).toBeCloseTo(1);
    expect(parseBaseballInnings('0.2')).toBeCloseTo(2);
    expect(parseBaseballInnings('5')).toBeCloseTo(15);
    expect(parseBaseballInnings('5.0')).toBeCloseTo(15);
    expect(parseBaseballInnings('5.1')).toBeCloseTo(16);
    expect(parseBaseballInnings('5.2')).toBeCloseTo(17);
  });

  it('rejects invalid innings formats', () => {
    expect(() => parseBaseballInnings('')).toThrow();
    expect(() => parseBaseballInnings('-1')).toThrow();
    expect(() => parseBaseballInnings('5.3')).toThrow();
    expect(() => parseBaseballInnings('5.9')).toThrow();
    expect(() => parseBaseballInnings('abc')).toThrow();
    expect(() => parseBaseballInnings('1.2.3')).toThrow();
  });
});

describe('formatOutsAsInnings', () => {
  it('formats outs as innings', () => {
    expect(formatOutsAsInnings(0)).toBe('0.0');
    expect(formatOutsAsInnings(15)).toBe('5.0');
    expect(formatOutsAsInnings(16)).toBe('5.1');
    expect(formatOutsAsInnings(17)).toBe('5.2');
  });
});

describe('aggregatePitcherHistory', () => {
  it('filters by requested pitcher and eligibility', () => {
    const apps = [
      appearance({ gamePk: 1, personId: 1, completedAt: new Date('2024-06-10T22:00:00Z') }),
      appearance({ gamePk: 2, personId: 2, completedAt: new Date('2024-06-11T22:00:00Z') }),
    ];
    const cutoff = new Date('2024-06-12T00:00:00Z');
    expect(aggregatePitcherHistory(apps, 1, cutoff).sampleSize).toBe(1);
  });

  it('excludes future games by cutoff', () => {
    const apps = [
      appearance({ gamePk: 3, completedAt: new Date('2099-01-01T03:00:00Z') }),
    ];
    const cutoff = new Date('2024-06-11T00:00:00Z');
    expect(aggregatePitcherHistory(apps, 1, cutoff).sampleSize).toBe(0);
  });

  it('excludes suspended games', () => {
    const apps = [
      appearance({ gamePk: 4, status: 'SUSPENDED', completedAt: new Date('2024-06-10T22:00:00Z') }),
    ];
    const cutoff = new Date('2024-06-11T00:00:00Z');
    expect(aggregatePitcherHistory(apps, 1, cutoff).sampleSize).toBe(0);
  });

  it('excludes missing completion timestamp', () => {
    const apps = [
      appearance({ gamePk: 5, completedAt: null }),
    ];
    const cutoff = new Date('2024-06-11T00:00:00Z');
    expect(aggregatePitcherHistory(apps, 1, cutoff).sampleSize).toBe(0);
  });

  it('excludes invalid innings with warning', () => {
    const apps = [
      appearance({ gamePk: 6, inningsPitched: 'not-an-innings' }),
    ];
    const result = aggregatePitcherHistory(apps, 1, new Date('2024-07-01T00:00:00Z'));
    expect(result.sampleSize).toBe(0);
    expect(result.warnings).toContain('invalid_innings_6');
  });

  it('includes starter and reliever together', () => {
    const apps = [
      appearance({ gamePk: 1, started: true, inningsPitched: '5.0', earnedRuns: 2, hitsAllowed: 7, walks: 1, strikeouts: 5, homeRunsAllowed: 1 }),
      appearance({ gamePk: 2, started: false, inningsPitched: '1.2', earnedRuns: 0, hitsAllowed: 1, walks: 0, strikeouts: 2, homeRunsAllowed: 0 }),
    ];
    const cutoff = new Date('2024-06-20T00:00:00Z');
    const result = aggregatePitcherHistory(apps, 1, cutoff);
    expect(result.appearances).toBe(2);
    expect(result.gamesStarted).toBe(1);
    expect(result.sampleSize).toBe(2);
  });

  it('computes rates and recent starts', () => {
    const apps = [
      appearance({ gamePk: 1, gameStart: new Date('2024-06-01T19:00:00Z'), completedAt: new Date('2024-06-01T22:00:00Z'), started: true, inningsPitched: '5.0', earnedRuns: 2, hitsAllowed: 7, walks: 1, strikeouts: 5, homeRunsAllowed: 1 }),
      appearance({ gamePk: 2, gameStart: new Date('2024-06-07T19:00:00Z'), completedAt: new Date('2024-06-07T22:00:00Z'), started: true, inningsPitched: '7.0', earnedRuns: 1, hitsAllowed: 4, walks: 2, strikeouts: 6, homeRunsAllowed: 0 }),
    ];
    const cutoff = new Date('2024-06-14T00:00:00Z');
    const result = aggregatePitcherHistory(apps, 1, cutoff);
    expect(result.sampleSize).toBe(2);
    expect(result.gamesStarted).toBe(2);
    expect(result.inningsPitchedDisplay).toBe('12.0');
    expect(result.era).toBeCloseTo((3 / 12) * 9);
    expect(result.whip).toBeCloseTo((3 + 11) / 12);
    expect(result.kPer9).toBeCloseTo((11 / 12) * 9);
    expect(result.bbPer9).toBeCloseTo((3 / 12) * 9);
    expect(result.hPer9).toBeCloseTo((11 / 12) * 9);
    expect(result.hrPer9).toBeCloseTo((1 / 12) * 9);
    expect(result.recent3Starts).toHaveLength(2);
    expect(result.recent5Starts).toHaveLength(2);
    expect(result.daysRest).toBe(6);
    expect(result.previousStartDate?.getTime()).toBe(new Date('2024-06-07T19:00:00Z').getTime());
  });

  it('zero outs gives null rates', () => {
    const apps = [
      appearance({ gamePk: 1, started: true, inningsPitched: '0.0', earnedRuns: 0, hitsAllowed: 0, walks: 1, strikeouts: 0, homeRunsAllowed: 0 }),
    ];
    const result = aggregatePitcherHistory(apps, 1, new Date('2024-07-01T00:00:00Z'));
    expect(result.appearances).toBe(1);
    expect(result.era).toBeNull();
    expect(result.whip).toBeNull();
    expect(result.kPer9).toBeNull();
    expect(result.bbPer9).toBeNull();
    expect(result.hPer9).toBeNull();
    expect(result.hrPer9).toBeNull();
  });

  it('does not mutate input', () => {
    const input = [
      appearance({ gamePk: 1, inningsPitched: '5.0', started: true }),
      appearance({ gamePk: 2, inningsPitched: '7.0', started: true }),
    ];
    aggregatePitcherHistory(input, 1, new Date('2024-07-01T00:00:00Z'));
    expect(input[0].inningsPitched).toBe('5.0');
    expect(input[1].inningsPitched).toBe('7.0');
  });
});
