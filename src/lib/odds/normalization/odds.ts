import type { NormalizedOdds, OddsSample } from '@/lib/odds/types';
import { normalizeMarketKey, normalizeSelection } from './markets';
import { canonicalizeBookmaker } from './bookmakers';

export function normalizeOdds(raw: Record<string, unknown>): NormalizedOdds {
  const marketKeyRaw = String(raw.marketKey ?? raw.market ?? raw.market_name ?? '');
  const selectionRaw = String(raw.selection ?? raw.selectionName ?? raw.outcome ?? '');

  const startSource = raw.timestamp ?? raw.startTimeUtc ?? raw.start_time ?? raw.commence_time;
  let timestamp: Date;
  const ts = startSource as string | number | Date | undefined;
  if (ts instanceof Date) {
    timestamp = ts;
  } else if (typeof ts === 'string' || typeof ts === 'number') {
    timestamp = new Date(ts);
  } else {
    timestamp = new Date();
  }

  return {
    eventId: String(raw.eventId ?? raw.event_id ?? raw.eventExternalId ?? ''),
    bookmaker: String(raw.bookmaker ?? raw.site ?? ''),
    marketKey: normalizeMarketKey(marketKeyRaw),
    selectionId: String(raw.selectionId ?? raw.selection_id ?? raw.outcome_id ?? ''),
    selection: normalizeSelection(selectionRaw),
    line: typeof raw.line === 'string' ? raw.line : undefined,
    decimalOdds: Number(raw.decimalOdds ?? raw.price ?? raw.odds ?? 0),
    timestamp,
    raw,
  };
}

export function toOddsSample(odds: NormalizedOdds, fetchedAt: Date): OddsSample {
  return {
    id: `${odds.eventId}-${odds.bookmaker}-${odds.marketKey}-${odds.selectionId}`,
    eventId: odds.eventId,
    bookmaker: odds.bookmaker,
    marketKey: odds.marketKey,
    selectionId: odds.selectionId,
    selection: odds.selection,
    line: odds.line,
    decimalOdds: odds.decimalOdds,
    timestamp: odds.timestamp,
    raw: odds.raw as OddsSample['raw'],
    fetchedAt,
  };
}
