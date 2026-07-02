import { describe, it, expect } from 'vitest';
import { isOfficialDateAfterCutoff, formatMLBCalendarDate } from '@/lib/backtesting/mlb/live-history/historical-date';

describe('formatMLBCalendarDate', () => {
  it('uses America/New_York date at an instant before UTC midnight', () => {
    expect(formatMLBCalendarDate(new Date('2024-06-02T01:00:00Z'))).toBe('2024-06-01');
  });

  it('uses America/New_York date safely for a typical backtest instant', () => {
    expect(formatMLBCalendarDate(new Date('2024-06-01T20:00:00Z'))).toBe('2024-06-01');
  });
});

describe('isOfficialDateAfterCutoff', () => {
  it('returns false for officialDate before cutoff calendar date', () => {
    expect(isOfficialDateAfterCutoff('2024-05-30', new Date('2024-06-01T20:00:00Z'))).toBe(false);
  });

  it('returns false for officialDate equal to cutoff calendar date', () => {
    expect(isOfficialDateAfterCutoff('2024-06-01', new Date('2024-06-01T20:00:00Z'))).toBe(false);
  });

  it('returns true for officialDate after cutoff calendar date', () => {
    expect(isOfficialDateAfterCutoff('2024-06-02', new Date('2024-06-01T20:00:00Z'))).toBe(true);
  });

  it('returns false for null officialDate', () => {
    expect(isOfficialDateAfterCutoff(null, new Date('2024-06-01T20:00:00Z'))).toBe(false);
  });

  it('returns false for undefined officialDate', () => {
    expect(isOfficialDateAfterCutoff(undefined, new Date('2024-06-01T20:00:00Z'))).toBe(false);
  });

  it('returns false for malformed officialDate', () => {
    expect(isOfficialDateAfterCutoff('invalid', new Date('2024-06-01T20:00:00Z'))).toBe(false);
  });
});

describe('timezone boundary guard', () => {
  const cutoff = new Date('2024-06-02T01:00:00Z');

  it('does not skip an officialDate that is still the prior MLB/ET calendar date', () => {
    expect(isOfficialDateAfterCutoff('2024-06-01', cutoff)).toBe(false);
  });

  it('skips the next MLB calendar date even though it is not yet June 2 in ET', () => {
    expect(isOfficialDateAfterCutoff('2024-06-02', cutoff)).toBe(true);
  });
});
