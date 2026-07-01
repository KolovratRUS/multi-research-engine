export type CanonicalBookmakerValue =
  | 'SPORTSBET'
  | 'POINTSBET'
  | 'UNIBET'
  | 'LADBROKES'
  | 'BETR'
  | 'PALMERBET'
  | 'BETFAIR'
  | 'OTHER';

export function canonicalizeBookmaker(raw: string): CanonicalBookmakerValue {
  const value = raw.toLowerCase().trim();
  if (value.includes('sportsbet')) return 'SPORTSBET';
  if (value.includes('pointsbet')) return 'POINTSBET';
  if (value.includes('unibet')) return 'UNIBET';
  if (value.includes('ladbrokes')) return 'LADBROKES';
  if (value.includes('betr')) return 'BETR';
  if (value.includes('palmerbet')) return 'PALMERBET';
  if (value.includes('betfair')) return 'BETFAIR';
  return 'OTHER';
}

export function isSportsbetAvailable(providerBookmakers: CanonicalBookmakerValue[]): boolean {
  return providerBookmakers.includes('SPORTSBET');
}
