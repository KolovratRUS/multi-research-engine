export interface CorrelationTag {
  tag: string;
  severity: 'low' | 'moderate' | 'strong';
  description: string;
}

const KNOWN_CORRELATIONS: CorrelationTag[] = [
  {
    tag: 'same_event',
    severity: 'strong',
    description: 'Two legs from the same event are strongly correlated.',
  },
  {
    tag: 'same_team',
    severity: 'moderate',
    description: 'Two legs involving the same team share contextual factors.',
  },
  {
    tag: 'same_pitcher',
    severity: 'moderate',
    description: 'Two pitcher-related legs in the same game.',
  },
];

export function detectCorrelations(
  a: { id: string; tags?: string[] },
  b: { id: string; tags?: string[] },
): CorrelationTag | null {
  const tagsA = new Set(a.tags ?? []);
  const tagsB = new Set(b.tags ?? []);

  const shared = [...tagsA].filter((t) => tagsB.has(t));
  if (shared.length === 0) return null;

  const tag = shared[0];
  const found = KNOWN_CORRELATIONS.find((c) => c.tag === tag);
  if (!found) return null;

  return { ...found };
}

export function isCorrelationStrong(tag: string): boolean {
  const found = KNOWN_CORRELATIONS.find((c) => c.tag === tag);
  return found?.severity === 'strong';
}
