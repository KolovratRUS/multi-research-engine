/**
 * MLB calendar-date prefilter for historical feed loading.
 *
 * `officialDate` is a calendar date string.  This helper returns true only
 * when a schedule row is certainly after the cutoff calendar date, so its
 * feed can be skipped before any network or cache access.
 *
 * Semantics:
 *
 * - `officialDate after MLB calendar date at cutoff instant`  → true (skip feed)
 * - `officialDate before MLB calendar date at cutoff instant`  → false (allow feed, aggregator filters)
 * - `officialDate equal to MLB calendar date at cutoff instant` → false (allow feed, aggregator filters)
 * - `officialDate missing, null, or malformed`  → false (conservative: allow feed)
 *
 * The MLB calendar date at the cutoff instant is derived deterministically
 * with the `America/New_York` time zone using `Intl.DateTimeFormat`.
 */

function parsePartsToDate(parts: ReadonlyArray<{ type: string; value: string }>): string {
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('Unexpected date parts from Intl.DateTimeFormat');
  }

  return `${year}-${month}-${day}`;
}

export function formatMLBCalendarDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/New_York',
  }).formatToParts(date);

  return parsePartsToDate(parts);
}

export function isOfficialDateAfterCutoff(
  officialDate: string | null | undefined,
  cutoff: Date,
): boolean {
  if (!officialDate) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(officialDate)) return false;
  const cutoffDate = formatMLBCalendarDate(cutoff);
  return officialDate > cutoffDate;
}
