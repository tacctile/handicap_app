/**
 * Ticket Allocator
 *
 * Pure TypeScript engine that selects an optimized ticket of bets from a pool.
 * Takes budget, bet count, risk mode, and returns selected bets with reasoning.
 *
 * @module betting/ticketAllocator
 */

import type { ScaledTopBet } from '../../components/TopBets/TopBetsView';
import type { TopBetType } from './topBetsGenerator';

// ============================================================================
// TYPES
// ============================================================================

export type RiskMode = 'Conservative' | 'Moderate' | 'Aggressive';

export interface TicketAllocatorInput {
  betPool: ScaledTopBet[];
  budget: number;
  betCount: number;
  mode: RiskMode;
  surpriseMode: boolean;
}

export interface SelectedBet extends ScaledTopBet {
  allocationReason: string;
  budgetShare: number;
}

export interface TicketAllocatorResult {
  selectedBets: SelectedBet[];
  totalCost: number;
  blendedConfidence: number;
  withinBudget: boolean;
  mode: RiskMode;
}

// ============================================================================
// COLUMN GROUPING
// ============================================================================

type ColumnGroup = 'WIN_SHOW' | 'EXACTA' | 'TRIFECTA' | 'SUPERFECTA';

const WHEEL_TYPES: TopBetType[] = ['EXACTA_WHEEL', 'TRIFECTA_WHEEL', 'SUPERFECTA_WHEEL'];

function getColumnGroup(internalType: TopBetType): ColumnGroup {
  if (['WIN', 'PLACE', 'SHOW'].includes(internalType)) return 'WIN_SHOW';
  if (
    [
      'EXACTA_STRAIGHT',
      'EXACTA_BOX_2',
      'EXACTA_BOX_3',
      'EXACTA_BOX_4',
      'EXACTA_BOX_5',
      'EXACTA_BOX_6',
      'EXACTA_WHEEL',
      'QUINELLA',
    ].includes(internalType)
  )
    return 'EXACTA';
  if (
    [
      'TRIFECTA_STRAIGHT',
      'TRIFECTA_BOX_3',
      'TRIFECTA_BOX_4',
      'TRIFECTA_BOX_5',
      'TRIFECTA_BOX_6',
      'TRIFECTA_KEY',
      'TRIFECTA_WHEEL',
    ].includes(internalType)
  )
    return 'TRIFECTA';
  return 'SUPERFECTA';
}

function sortedHorseKey(horseNumbers: number[]): string {
  return [...horseNumbers].sort((a, b) => a - b).join(',');
}

// ============================================================================
// ALLOCATION REASON TEMPLATES
// ============================================================================

function generateAllocationReason(bet: ScaledTopBet): string {
  const group = getColumnGroup(bet.internalType);

  switch (group) {
    case 'WIN_SHOW':
      return `Our top pick in this race at ${bet.horses[0]?.name ?? 'unknown'} — ${Math.round(bet.probability)}% confidence this finishes in the money.`;
    case 'EXACTA':
      return `Best exacta combination by expected value — covers ${bet.combinationsInvolved} horse combination${bet.combinationsInvolved !== 1 ? 's' : ''} for $${bet.scaledCost}.`;
    case 'TRIFECTA':
      return `Top trifecta play — ${Math.round(bet.probability)}% confidence, ${bet.combinationsInvolved} combination${bet.combinationsInvolved !== 1 ? 's' : ''} covered.`;
    case 'SUPERFECTA':
      return `High-upside superfecta — low probability but significant payout potential at $${bet.scaledCost}.`;
    default:
      return `Selected for best expected value in this category.`;
  }
}

// ============================================================================
// BLENDED CONFIDENCE
// ============================================================================

function calculateBlendedConfidence(bets: ScaledTopBet[]): number {
  if (bets.length === 0) return 0;
  const totalCost = bets.reduce((sum, b) => sum + b.scaledCost, 0);
  if (totalCost === 0) return 0;
  const weighted = bets.reduce((sum, b) => sum + b.probability * b.scaledCost, 0);
  return Math.round((weighted / totalCost) * 10) / 10;
}

// ============================================================================
// MAIN ALLOCATION PIPELINE
// ============================================================================

export function allocateTicket(input: TicketAllocatorInput): TicketAllocatorResult {
  const { betPool, budget, betCount, mode, surpriseMode } = input;

  // Step A — Mode filter
  let filtered: ScaledTopBet[];
  if (mode === 'Conservative') {
    filtered = betPool.filter((b) => b.riskTier === 'Conservative');
  } else if (mode === 'Moderate') {
    filtered = betPool.filter((b) => b.riskTier === 'Conservative' || b.riskTier === 'Moderate');
  } else {
    filtered = [...betPool];
  }

  // Step B — Wheel exclusion
  filtered = filtered.filter((b) => !WHEEL_TYPES.includes(b.internalType));

  // Step C — Column grouping
  const groups = new Map<ColumnGroup, ScaledTopBet[]>();
  for (const bet of filtered) {
    const group = getColumnGroup(bet.internalType);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(bet);
  }

  // Step D — Intra-column deduplication
  for (const [group, bets] of groups) {
    const seen = new Map<string, ScaledTopBet>();
    for (const bet of bets) {
      const key = sortedHorseKey(bet.horseNumbers);
      const existing = seen.get(key);
      if (!existing || bet.expectedValue > existing.expectedValue) {
        seen.set(key, bet);
      }
    }
    groups.set(group, Array.from(seen.values()));
  }

  // Step E — Column candidate selection (top 3 by EV from each group)
  const candidates: ScaledTopBet[] = [];
  for (const bets of groups.values()) {
    const sorted = [...bets].sort((a, b) => b.expectedValue - a.expectedValue);
    candidates.push(...sorted.slice(0, 3));
  }

  // Step F/G — Budget-aware selection
  const maxBudget = budget * 1.1;
  let selected: ScaledTopBet[];

  if (surpriseMode) {
    // Step G — Surprise mode: quality floor + random shuffle
    const qualityFiltered = candidates.filter((b) => b.probability >= 2);
    const shuffled = [...qualityFiltered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    selected = greedySelect(shuffled, betCount, maxBudget);
  } else {
    // Step F — Deterministic: sort by EV descending, greedy select
    const evSorted = [...candidates].sort((a, b) => b.expectedValue - a.expectedValue);
    selected = greedySelect(evSorted, betCount, maxBudget);
  }

  // Calculate results
  const totalCost = selected.reduce((sum, b) => sum + b.scaledCost, 0);
  const blendedConfidence = calculateBlendedConfidence(selected);

  const selectedBets: SelectedBet[] = selected.map((bet) => ({
    ...bet,
    allocationReason: generateAllocationReason(bet),
    budgetShare: totalCost > 0 ? Math.round((bet.scaledCost / totalCost) * 100) : 0,
  }));

  return {
    selectedBets,
    totalCost,
    blendedConfidence,
    withinBudget: totalCost <= maxBudget,
    mode,
  };
}

/**
 * Greedy selection: pick bets one at a time, respecting budget and one-per-column.
 */
function greedySelect(
  candidates: ScaledTopBet[],
  maxCount: number,
  maxBudget: number
): ScaledTopBet[] {
  const selected: ScaledTopBet[] = [];
  const usedGroups = new Set<ColumnGroup>();
  let runningCost = 0;

  for (const bet of candidates) {
    if (selected.length >= maxCount) break;

    const group = getColumnGroup(bet.internalType);
    if (usedGroups.has(group)) continue;
    if (runningCost + bet.scaledCost > maxBudget) continue;

    selected.push(bet);
    usedGroups.add(group);
    runningCost += bet.scaledCost;
  }

  return selected;
}

/**
 * Generate a surprise ticket — wrapper around allocateTicket with surpriseMode forced on.
 */
export function generateSurpriseTicket(input: TicketAllocatorInput): TicketAllocatorResult {
  return allocateTicket({ ...input, surpriseMode: true });
}
