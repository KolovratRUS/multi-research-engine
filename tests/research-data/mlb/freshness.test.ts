import { describe, it, expect } from 'vitest';
import { isStale } from '@/lib/research-data/mlb/normalization';
import { DEFAULT_FRESHNESS_CONFIG } from '@/lib/research-data/types';

describe('freshness', () => {
  it('marks data as stale after threshold', () => {
    const old = new Date(Date.now() - DEFAULT_FRESHNESS_CONFIG.scheduleStaleMs - 1);
    expect(isStale(old, DEFAULT_FRESHNESS_CONFIG, 'scheduleStaleMs')).toBe(true);
  });

  it('marks data as fresh before threshold', () => {
    const fresh = new Date(Date.now() - DEFAULT_FRESHNESS_CONFIG.scheduleStaleMs + 1);
    expect(isStale(fresh, DEFAULT_FRESHNESS_CONFIG, 'scheduleStaleMs')).toBe(false);
  });

  it('marks pitcher data as stale after threshold', () => {
    const old = new Date(Date.now() - DEFAULT_FRESHNESS_CONFIG.probablePitcherStaleMs - 1);
    expect(isStale(old, DEFAULT_FRESHNESS_CONFIG, 'probablePitcherStaleMs')).toBe(true);
  });
});
