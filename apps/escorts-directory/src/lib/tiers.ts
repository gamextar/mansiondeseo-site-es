export const ESCORT_TIERS = {
  basic: { label: 'Básico', rank: 1, accent: '#767684' },
  bronze: { label: 'Bronce', rank: 2, accent: '#b87946' },
  silver: { label: 'Plata', rank: 3, accent: '#bdc3cf' },
  gold: { label: 'Oro', rank: 4, accent: '#d7aa3c' },
  platinum: { label: 'Platino', rank: 5, accent: '#8bd7e8' },
} as const;

export type EscortTier = keyof typeof ESCORT_TIERS;

export function isEscortTier(value: unknown): value is EscortTier {
  return typeof value === 'string' && value in ESCORT_TIERS;
}

export function tierRank(value: unknown) {
  return isEscortTier(value) ? ESCORT_TIERS[value].rank : 0;
}
