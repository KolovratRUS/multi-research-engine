export function normalizeMarketKey(raw: string): string {
  const value = raw.toLowerCase().trim();
  if (value.includes('h2h') || value.includes('moneyline') || value.includes('match_winner')) {
    return 'H2H';
  }
  if (value.includes('spread') || value.includes('handicap')) {
    return 'SPREADS';
  }
  if (value.includes('total') || value.includes('over_under')) {
    return 'TOTALS';
  }
  if (value.includes('team_total')) {
    return 'TEAM_TOTALS';
  }
  if (value.includes('player') || value.includes('prop')) {
    return 'PLAYER_PROP';
  }
  return 'ALTERNATE';
}

export function normalizeSelection(raw: string): string {
  return raw.trim();
}
