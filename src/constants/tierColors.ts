import type { BettingTier } from '../lib/betting/tierClassification';

export const TIER_COLORS: Record<BettingTier, { bg: string; border: string; text: string }> = {
  tier1: { bg: 'rgba(25, 171, 181, 0.2)', border: 'rgba(25, 171, 181, 0.5)', text: '#19abb5' },
  tier2: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)', text: '#3b82f6' },
  tier3: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#f59e0b' },
};

/** Convenience lookup by tier number (1, 2, 3) */
export const TIER_COLORS_BY_NUMBER: Record<number, { bg: string; border: string; text: string }> = {
  1: TIER_COLORS.tier1,
  2: TIER_COLORS.tier2,
  3: TIER_COLORS.tier3,
};
