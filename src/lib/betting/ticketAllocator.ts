/**
 * Ticket Allocator
 *
 * Pure TypeScript engine that selects an optimized ticket of bets from a pool.
 * Takes budget, bet count, risk mode, and returns selected bets with reasoning.
 *
 * Features:
 * - Composite quality scoring (EV + probability + cost efficiency)
 * - Budget distribution engine with per-bet base amount scaling
 * - Exact bet count guarantee
 * - Per-count availability computation with unlock suggestions
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

export interface AllocatedBet extends SelectedBet {
  computedBase: number;
  computedCost: number;
  isOverBudget: boolean;
  overBudgetAmount: number;
  scaledScript: string;
}

export interface UnlockSuggestion {
  betCount: number;
  additionalBudgetNeeded: number;
  betDescription: string;
  betType: string;
  estimatedCost: number;
}

export interface TicketAvailability {
  [betCount: number]: {
    available: boolean;
    suggestion: UnlockSuggestion | null;
  };
}

export interface TicketIntegrityResult {
  verified: boolean;
  issueCount: number;
  issues: string[];
}

export type UtilizationStatus = 'excellent' | 'good' | 'low' | 'critical';

export interface TicketAllocatorResult {
  bets: AllocatedBet[];
  totalCost: number;
  budgetUtilization: number;
  blendedConfidence: number;
  integrity: TicketIntegrityResult;
  availability: TicketAvailability;
  utilizationStatus: UtilizationStatus;
  mode: RiskMode;
  shortfall: number;
  // Legacy compat
  selectedBets: AllocatedBet[];
  withinBudget: boolean;
}

// ============================================================================
// COLUMN GROUPING — 6 groups (WIN, PLACE, SHOW split)
// ============================================================================

type ColumnGroup = 'WIN' | 'PLACE' | 'SHOW' | 'EXACTA' | 'TRIFECTA' | 'SUPERFECTA';

const WHEEL_TYPES: TopBetType[] = ['EXACTA_WHEEL', 'TRIFECTA_WHEEL', 'SUPERFECTA_WHEEL'];

function getColumnGroup(internalType: TopBetType): ColumnGroup {
  if (internalType === 'WIN') return 'WIN';
  if (internalType === 'PLACE') return 'PLACE';
  if (internalType === 'SHOW') return 'SHOW';
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
// COMBINATIONS LOOKUP
// ============================================================================

function getCombinations(internalType: TopBetType, combinationsInvolved: number): number {
  if (combinationsInvolved > 0) return combinationsInvolved;

  const combMap: Record<string, number> = {
    WIN: 1,
    PLACE: 1,
    SHOW: 1,
    EXACTA_STRAIGHT: 1,
    EXACTA_BOX_2: 2,
    EXACTA_BOX_3: 6,
    EXACTA_BOX_4: 12,
    EXACTA_BOX_5: 20,
    EXACTA_BOX_6: 30,
    QUINELLA: 1,
    TRIFECTA_STRAIGHT: 1,
    TRIFECTA_BOX_3: 6,
    TRIFECTA_BOX_4: 24,
    TRIFECTA_BOX_5: 60,
    TRIFECTA_BOX_6: 120,
    TRIFECTA_KEY: 1,
    SUPERFECTA_STRAIGHT: 1,
    SUPERFECTA_BOX_4: 24,
    SUPERFECTA_BOX_5: 120,
    SUPERFECTA_BOX_6: 360,
    SUPERFECTA_KEY: 1,
  };

  return combMap[internalType] ?? 1;
}

// ============================================================================
// COMPOSITE QUALITY SCORING
// ============================================================================

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

interface CompositeWeights {
  ev: number;
  prob: number;
  costEfficiency: number;
}

function getModeWeights(mode: RiskMode): CompositeWeights {
  switch (mode) {
    case 'Conservative':
      return { ev: 0.2, prob: 0.6, costEfficiency: 0.2 };
    case 'Moderate':
      return { ev: 0.4, prob: 0.3, costEfficiency: 0.3 };
    case 'Aggressive':
      return { ev: 0.6, prob: 0.2, costEfficiency: 0.2 };
  }
}

function computeCompositeScores(
  candidates: ScaledTopBet[],
  mode: RiskMode
): Map<ScaledTopBet, number> {
  if (candidates.length === 0) return new Map();

  const weights = getModeWeights(mode);

  // Compute pool-wide min/max for normalization
  let minEV = Infinity,
    maxEV = -Infinity;
  let minProb = Infinity,
    maxProb = -Infinity;
  let minCE = Infinity,
    maxCE = -Infinity;

  const costEfficiencies: Map<ScaledTopBet, number> = new Map();
  for (const bet of candidates) {
    const baseCost = bet.cost || 1;
    const ce = bet.expectedValue / baseCost;
    costEfficiencies.set(bet, ce);

    if (bet.expectedValue < minEV) minEV = bet.expectedValue;
    if (bet.expectedValue > maxEV) maxEV = bet.expectedValue;
    if (bet.probability < minProb) minProb = bet.probability;
    if (bet.probability > maxProb) maxProb = bet.probability;
    if (ce < minCE) minCE = ce;
    if (ce > maxCE) maxCE = ce;
  }

  const scores = new Map<ScaledTopBet, number>();
  for (const bet of candidates) {
    const evScore = normalize(bet.expectedValue, minEV, maxEV);
    const probScore = normalize(bet.probability, minProb, maxProb);
    const ceScore = normalize(costEfficiencies.get(bet)!, minCE, maxCE);

    const composite =
      evScore * weights.ev + probScore * weights.prob + ceScore * weights.costEfficiency;
    scores.set(bet, composite);
  }

  return scores;
}

// ============================================================================
// ALLOCATION REASON TEMPLATES
// ============================================================================

function generateAllocationReason(bet: ScaledTopBet): string {
  const group = getColumnGroup(bet.internalType);

  switch (group) {
    case 'WIN':
      return `Top win pick — ${bet.horses[0]?.name ?? 'unknown'} at ${Math.round(bet.probability)}% confidence.`;
    case 'PLACE':
      return `Place bet on ${bet.horses[0]?.name ?? 'unknown'} — ${Math.round(bet.probability)}% chance to finish top 2.`;
    case 'SHOW':
      return `Show bet on ${bet.horses[0]?.name ?? 'unknown'} — ${Math.round(bet.probability)}% chance to finish top 3.`;
    case 'EXACTA':
      return `Best exacta combination — covers ${bet.combinationsInvolved} combination${bet.combinationsInvolved !== 1 ? 's' : ''}.`;
    case 'TRIFECTA':
      return `Top trifecta play — ${Math.round(bet.probability)}% confidence, ${bet.combinationsInvolved} combination${bet.combinationsInvolved !== 1 ? 's' : ''} covered.`;
    case 'SUPERFECTA':
      return `High-upside superfecta — low probability but significant payout potential.`;
    default:
      return `Selected for best composite quality score in this category.`;
  }
}

// ============================================================================
// BLENDED CONFIDENCE
// ============================================================================

function calculateBlendedConfidence(bets: AllocatedBet[]): number {
  if (bets.length === 0) return 0;
  const totalCost = bets.reduce((sum, b) => sum + b.computedCost, 0);
  if (totalCost === 0) return 0;
  const weighted = bets.reduce((sum, b) => sum + b.probability * b.computedCost, 0);
  return Math.round((weighted / totalCost) * 10) / 10;
}

// ============================================================================
// SCALE WHAT TO SAY (inline version — mirrors TopBetsView.scaleWhatToSay)
// ============================================================================

function scaleWhatToSay(original: string, baseAmount: number): string {
  return original.replace(/\$1/g, `$${baseAmount}`);
}

// ============================================================================
// FORMAT BET DESCRIPTION
// ============================================================================

export function formatBetDescription(bet: ScaledTopBet): string {
  const type = bet.internalType;
  const horseNums = bet.horseNumbers;
  const horses = bet.horses;

  if (type === 'WIN') {
    const name = horses[0]?.name ?? `horse #${horseNums[0]}`;
    return `Win bet on ${name}`;
  }
  if (type === 'PLACE') {
    const name = horses[0]?.name ?? `horse #${horseNums[0]}`;
    return `Place bet on ${name}`;
  }
  if (type === 'SHOW') {
    const name = horses[0]?.name ?? `horse #${horseNums[0]}`;
    return `Show bet on ${name}`;
  }

  // Exotic bets — use horse numbers
  const numList = horseNums.join(', ');

  if (type.startsWith('EXACTA')) {
    const boxMatch = type.match(/BOX_(\d)/);
    if (boxMatch) {
      return `Exacta Box covering horses ${numList}`;
    }
    return `Exacta Straight covering horses ${numList}`;
  }
  if (type === 'QUINELLA') {
    return `Quinella covering horses ${numList}`;
  }
  if (type.startsWith('TRIFECTA')) {
    const boxMatch = type.match(/BOX_(\d)/);
    if (boxMatch) {
      return `Trifecta Box covering horses ${numList}`;
    }
    if (type === 'TRIFECTA_KEY') {
      return `Trifecta Key covering horses ${numList}`;
    }
    return `Trifecta Straight covering horses ${numList}`;
  }
  if (type.startsWith('SUPERFECTA')) {
    const boxMatch = type.match(/BOX_(\d)/);
    if (boxMatch) {
      return `Superfecta Box covering horses ${numList}`;
    }
    if (type === 'SUPERFECTA_KEY') {
      return `Superfecta Key covering horses ${numList}`;
    }
    return `Superfecta Straight covering horses ${numList}`;
  }

  return `${type.replace(/_/g, ' ')} covering horses ${numList}`;
}

// ============================================================================
// BUDGET DISTRIBUTION ENGINE
// ============================================================================

function budgetDistribution(
  selectedBets: (ScaledTopBet & { allocationReason: string })[],
  budget: number
): AllocatedBet[] {
  const N = selectedBets.length;
  if (N === 0) return [];

  // Step G1 — Calculate allocation weights
  const rawWeights: number[] = selectedBets.map((bet) => {
    if (bet.kellyAmount && bet.kellyAmount > 0) {
      return bet.kellyAmount;
    }
    const baseCost = bet.cost || 1;
    return bet.expectedValue / baseCost;
  });

  const totalWeight = rawWeights.reduce((sum, w) => sum + w, 0);
  const normalizedWeights =
    totalWeight > 0 ? rawWeights.map((w) => w / totalWeight) : rawWeights.map(() => 1 / N);

  // Step G2 — Assign budget shares with min/max clamps
  const minShare = budget / (N * 2);
  const maxShare = budget * 0.6;

  let shares = normalizedWeights.map((w) => {
    let share = budget * w;
    share = Math.max(minShare, share);
    share = Math.min(maxShare, share);
    return share;
  });

  // Re-normalize after clamping
  const sharesTotal = shares.reduce((sum, s) => sum + s, 0);
  if (sharesTotal > 0) {
    shares = shares.map((s) => (s / sharesTotal) * budget);
  }

  // Step G3 — Derive base amounts
  const allocated: AllocatedBet[] = selectedBets.map((bet, i) => {
    const combinations = getCombinations(bet.internalType, bet.combinationsInvolved);
    const rawBase = shares[i]! / combinations;
    const computedBase = Math.max(1, Math.round(rawBase));
    const computedCost = computedBase * combinations;

    return {
      ...bet,
      computedBase,
      computedCost,
      budgetShare: Math.round(shares[i]!),
      isOverBudget: false,
      overBudgetAmount: 0,
      scaledScript: scaleWhatToSay(bet.scaledWhatToSay || bet.whatToSay, computedBase),
    };
  });

  // Step G4 — Adjust last bet to hit budget target
  const totalAfterRounding = allocated.reduce((sum, b) => sum + b.computedCost, 0);
  const variance = budget - totalAfterRounding;

  if (Math.abs(variance) > 0 && allocated.length > 0) {
    // Find the bet with most combinations (most flexible)
    let flexIdx = 0;
    let maxComb = 0;
    for (let i = 0; i < allocated.length; i++) {
      const comb = getCombinations(allocated[i]!.internalType, allocated[i]!.combinationsInvolved);
      if (comb > maxComb) {
        maxComb = comb;
        flexIdx = i;
      }
    }

    const flexBet = allocated[flexIdx]!;
    const flexComb = getCombinations(flexBet.internalType, flexBet.combinationsInvolved);
    const adjustment = Math.round(variance / flexComb);
    const newBase = Math.max(1, flexBet.computedBase + adjustment);
    flexBet.computedBase = newBase;
    flexBet.computedCost = newBase * flexComb;
    flexBet.scaledScript = scaleWhatToSay(flexBet.scaledWhatToSay || flexBet.whatToSay, newBase);
  }

  // Step G5 — Budget tolerance check
  const finalTotal = allocated.reduce((sum, b) => sum + b.computedCost, 0);
  const utilizationPct = (finalTotal / budget) * 100;

  if (utilizationPct > 115) {
    // Sort by computedCost descending to reduce the most expensive first
    const byExpense = [...allocated].sort((a, b) => b.computedCost - a.computedCost);
    for (const bet of byExpense) {
      if (bet.computedBase <= 1) continue;
      const comb = getCombinations(bet.internalType, bet.combinationsInvolved);
      bet.computedBase = Math.max(1, bet.computedBase - 1);
      bet.computedCost = bet.computedBase * comb;
      bet.scaledScript = scaleWhatToSay(bet.scaledWhatToSay || bet.whatToSay, bet.computedBase);

      const newTotal = allocated.reduce((sum, b) => sum + b.computedCost, 0);
      if ((newTotal / budget) * 100 <= 115) break;
    }
  } else if (utilizationPct > 110 && utilizationPct <= 115) {
    // Mark the most expensive bet as slightly over budget
    const mostExpensive = allocated.reduce(
      (max, b) => (b.computedCost > max.computedCost ? b : max),
      allocated[0]!
    );
    mostExpensive.isOverBudget = true;
    mostExpensive.overBudgetAmount = Math.round(
      allocated.reduce((sum, b) => sum + b.computedCost, 0) - budget * 1.1
    );
  }

  // Step G6 — Regenerate all scaled scripts with final base amounts
  for (const bet of allocated) {
    bet.scaledScript = scaleWhatToSay(bet.scaledWhatToSay || bet.whatToSay, bet.computedBase);
    bet.computedCost =
      bet.computedBase * getCombinations(bet.internalType, bet.combinationsInvolved);
  }

  return allocated;
}

// ============================================================================
// UTILIZATION STATUS
// ============================================================================

function getUtilizationStatus(pct: number): UtilizationStatus {
  if (pct >= 85 && pct <= 115) return 'excellent';
  if (pct >= 70 && pct < 85) return 'good';
  if (pct >= 50 && pct < 70) return 'low';
  return 'critical';
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

  // Step C — Column grouping (6 groups: WIN, PLACE, SHOW, EXACTA, TRIFECTA, SUPERFECTA)
  const groups = new Map<ColumnGroup, ScaledTopBet[]>();
  for (const bet of filtered) {
    const group = getColumnGroup(bet.internalType);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(bet);
  }

  // Step D — Intra-column deduplication
  for (const [, bets] of groups) {
    const seen = new Map<string, ScaledTopBet>();
    for (const bet of bets) {
      const key = sortedHorseKey(bet.horseNumbers);
      const existing = seen.get(key);
      if (!existing || bet.expectedValue > existing.expectedValue) {
        seen.set(key, bet);
      }
    }
    const group = getColumnGroup(bets[0]!.internalType);
    groups.set(group, Array.from(seen.values()));
  }

  // Step E — Column candidate selection (top 5 by composite score from each group)
  const compositeAll = computeCompositeScores(filtered, mode);
  const candidates: ScaledTopBet[] = [];
  for (const bets of groups.values()) {
    const sorted = [...bets].sort((a, b) => {
      const scoreA = compositeAll.get(a) ?? 0;
      const scoreB = compositeAll.get(b) ?? 0;
      return scoreB - scoreA;
    });
    candidates.push(...sorted.slice(0, 5));
  }

  // Step F/G — Selection
  let selected: ScaledTopBet[];

  if (surpriseMode) {
    // Step G — Surprise mode: quality floor + random shuffle
    const qualityFiltered = candidates.filter((b) => b.probability >= 5);
    const shuffled = [...qualityFiltered];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
    }
    selected = greedySelectByGroup(shuffled, betCount);
  } else {
    // Step F — Deterministic: sort by composite score descending, greedy select
    const compositeScores = computeCompositeScores(candidates, mode);
    const compositeSorted = [...candidates].sort((a, b) => {
      const scoreA = compositeScores.get(a) ?? 0;
      const scoreB = compositeScores.get(b) ?? 0;
      return scoreB - scoreA;
    });
    selected = greedySelectByGroup(compositeSorted, betCount);
  }

  // Compute shortfall
  const shortfall = Math.max(0, betCount - selected.length);

  // Add allocation reasons
  const withReasons = selected.map((bet) => ({
    ...bet,
    allocationReason: generateAllocationReason(bet),
  }));

  // Step G — Budget distribution engine
  const allocatedBets = budgetDistribution(withReasons, budget);

  // Calculate results
  const totalCost = allocatedBets.reduce((sum, b) => sum + b.computedCost, 0);
  const budgetUtilization = budget > 0 ? Math.round((totalCost / budget) * 100) : 0;
  const blendedConfidence = calculateBlendedConfidence(allocatedBets);
  const utilizationStatus = getUtilizationStatus(budgetUtilization);

  // Integrity verification
  const integrity = verifyTicket(allocatedBets, betPool);

  // Compute availability for bet counts 1-5
  const availability = computeAvailabilityInternal(betPool, budget, mode, candidates);

  // Set budgetShare as percentage
  for (const bet of allocatedBets) {
    bet.budgetShare = totalCost > 0 ? Math.round((bet.computedCost / totalCost) * 100) : 0;
  }

  return {
    bets: allocatedBets,
    totalCost,
    budgetUtilization,
    blendedConfidence,
    integrity,
    availability,
    utilizationStatus,
    mode,
    shortfall,
    // Legacy compat
    selectedBets: allocatedBets,
    withinBudget: totalCost <= budget * 1.15,
  };
}

/**
 * Greedy selection: pick bets one at a time, respecting one-per-column-group.
 * No budget constraint during selection — budget distribution handles scaling.
 */
function greedySelectByGroup(candidates: ScaledTopBet[], maxCount: number): ScaledTopBet[] {
  const selected: ScaledTopBet[] = [];
  const usedGroups = new Set<ColumnGroup>();

  for (const bet of candidates) {
    if (selected.length >= maxCount) break;

    const group = getColumnGroup(bet.internalType);
    if (usedGroups.has(group)) continue;

    selected.push(bet);
    usedGroups.add(group);
  }

  return selected;
}

/**
 * Generate a surprise ticket — wrapper around allocateTicket with surpriseMode forced on.
 */
export function generateSurpriseTicket(input: TicketAllocatorInput): TicketAllocatorResult {
  return allocateTicket({ ...input, surpriseMode: true });
}

// ============================================================================
// AVAILABILITY COMPUTATION
// ============================================================================

function computeAvailabilityInternal(
  betPool: ScaledTopBet[],
  budget: number,
  mode: RiskMode,
  allCandidates: ScaledTopBet[]
): TicketAvailability {
  const availability: TicketAvailability = {};

  for (let N = 1; N <= 5; N++) {
    // Run a lightweight allocation check for each count
    const testResult = runAllocationCheck(betPool, budget, N, mode);

    if (testResult.count >= N && testResult.utilization >= 70) {
      availability[N] = { available: true, suggestion: null };
    } else {
      // Find the next candidate bet that would be needed
      const nextBet = findNextCandidate(allCandidates, testResult.usedGroups);

      if (nextBet) {
        const combinations = getCombinations(nextBet.internalType, nextBet.combinationsInvolved);
        const estCostPerBet = Math.max(1, Math.round(budget / N)) * combinations;
        const neededBudget = testResult.totalBaseCost + estCostPerBet;
        const additionalNeeded = Math.max(0, Math.ceil(neededBudget - budget));

        availability[N] = {
          available: false,
          suggestion: {
            betCount: N,
            additionalBudgetNeeded: additionalNeeded,
            betDescription: formatBetDescription(nextBet),
            betType: nextBet.internalType,
            estimatedCost: estCostPerBet,
          },
        };
      } else {
        availability[N] = {
          available: false,
          suggestion: {
            betCount: N,
            additionalBudgetNeeded: 0,
            betDescription: 'Not enough bet types available in this mode',
            betType: '',
            estimatedCost: 0,
          },
        };
      }
    }
  }

  return availability;
}

interface AllocationCheck {
  count: number;
  totalBaseCost: number;
  utilization: number;
  usedGroups: Set<ColumnGroup>;
}

function runAllocationCheck(
  betPool: ScaledTopBet[],
  budget: number,
  betCount: number,
  mode: RiskMode
): AllocationCheck {
  // Quick allocation without full budget distribution — just check feasibility
  let filtered: ScaledTopBet[];
  if (mode === 'Conservative') {
    filtered = betPool.filter((b) => b.riskTier === 'Conservative');
  } else if (mode === 'Moderate') {
    filtered = betPool.filter((b) => b.riskTier === 'Conservative' || b.riskTier === 'Moderate');
  } else {
    filtered = [...betPool];
  }

  filtered = filtered.filter((b) => !WHEEL_TYPES.includes(b.internalType));

  const compositeScores = computeCompositeScores(filtered, mode);
  const sorted = [...filtered].sort((a, b) => {
    const scoreA = compositeScores.get(a) ?? 0;
    const scoreB = compositeScores.get(b) ?? 0;
    return scoreB - scoreA;
  });

  const selected: ScaledTopBet[] = [];
  const usedGroups = new Set<ColumnGroup>();

  for (const bet of sorted) {
    if (selected.length >= betCount) break;
    const group = getColumnGroup(bet.internalType);
    if (usedGroups.has(group)) continue;
    selected.push(bet);
    usedGroups.add(group);
  }

  // Estimate total cost with budget distribution
  const N = selected.length;
  let totalBaseCost = 0;
  if (N > 0) {
    const sharePerBet = budget / N;
    for (const bet of selected) {
      const combinations = getCombinations(bet.internalType, bet.combinationsInvolved);
      const base = Math.max(1, Math.round(sharePerBet / combinations));
      totalBaseCost += base * combinations;
    }
  }

  const utilization = budget > 0 ? (totalBaseCost / budget) * 100 : 0;

  return {
    count: selected.length,
    totalBaseCost,
    utilization,
    usedGroups,
  };
}

function findNextCandidate(
  allCandidates: ScaledTopBet[],
  usedGroups: Set<ColumnGroup>
): ScaledTopBet | null {
  for (const bet of allCandidates) {
    const group = getColumnGroup(bet.internalType);
    if (!usedGroups.has(group)) return bet;
  }
  return null;
}

export function computeAvailability(
  betPool: ScaledTopBet[],
  budget: number,
  mode: RiskMode
): TicketAvailability {
  // Build candidates for suggestion finding
  let filtered: ScaledTopBet[];
  if (mode === 'Conservative') {
    filtered = betPool.filter((b) => b.riskTier === 'Conservative');
  } else if (mode === 'Moderate') {
    filtered = betPool.filter((b) => b.riskTier === 'Conservative' || b.riskTier === 'Moderate');
  } else {
    filtered = [...betPool];
  }
  filtered = filtered.filter((b) => !WHEEL_TYPES.includes(b.internalType));

  const compositeScores = computeCompositeScores(filtered, mode);
  const sorted = [...filtered].sort((a, b) => {
    const scoreA = compositeScores.get(a) ?? 0;
    const scoreB = compositeScores.get(b) ?? 0;
    return scoreB - scoreA;
  });

  return computeAvailabilityInternal(betPool, budget, mode, sorted);
}

// ============================================================================
// TICKET INTEGRITY VERIFICATION
// ============================================================================

/**
 * Verify a ticket's integrity by cross-referencing horse numbers, window scripts,
 * and bet pool data.
 */
export function verifyTicket(
  selectedBets: AllocatedBet[] | SelectedBet[],
  betPool: ScaledTopBet[]
): TicketIntegrityResult {
  const issues: string[] = [];

  // Collect all horse numbers present in the bet pool
  const poolHorseNumbers = new Set<number>();
  for (const bet of betPool) {
    for (const num of bet.horseNumbers) {
      poolHorseNumbers.add(num);
    }
  }

  for (const bet of selectedBets) {
    const label = `${bet.internalType} (${bet.horses.map((h) => h.name).join(', ')})`;

    // Check a: horseNumbers array is non-empty
    if (!bet.horseNumbers || bet.horseNumbers.length === 0) {
      issues.push(`${label}: No horse numbers assigned`);
      continue;
    }

    // Check b: each horse number exists in the bet pool
    for (const num of bet.horseNumbers) {
      if (!poolHorseNumbers.has(num)) {
        issues.push(`${label}: Horse #${num} not found in bet pool`);
      }
    }

    // Check c: scaledWhatToSay contains at least one horse number as substring
    if (bet.scaledWhatToSay) {
      const scriptContainsHorse = bet.horseNumbers.some((num) =>
        bet.scaledWhatToSay.includes(String(num))
      );
      if (!scriptContainsHorse) {
        issues.push(`${label}: Window script does not reference any horse number`);
      }
    }

    // Check d: not a wheel type
    if (WHEEL_TYPES.includes(bet.internalType)) {
      issues.push(`${label}: Wheel bet type should not appear in ticket`);
    }

    // Check e: cost is greater than 0
    const cost = 'computedCost' in bet ? (bet as AllocatedBet).computedCost : bet.scaledCost;
    if (!cost || cost <= 0) {
      issues.push(`${label}: Bet cost is $0 or invalid`);
    }
  }

  return {
    verified: issues.length === 0,
    issueCount: issues.length,
    issues,
  };
}
