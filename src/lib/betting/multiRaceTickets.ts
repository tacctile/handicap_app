/**
 * Multi-Race Ticket Construction
 *
 * Builds optimal tickets for multi-race betting opportunities.
 * Determines which horses to use in each leg based on:
 * - Value plays (high confidence = SINGLE)
 * - Race contenders (competitive = SPREAD)
 * - Budget constraints
 * - Risk style preferences
 */

import type { RaceValueAnalysis, ValuePlay } from '../../hooks/useValueDetection';
import type { ScoredHorse } from '../scoring';
import type {
  MultiRaceBetType,
  MultiRaceOpportunity,
  MultiRaceBet,
  MultiRaceLeg,
  LegStrategy,
  RiskStyle,
  MultiRaceConfidence,
} from './betTypes';
import { MULTI_RACE_BET_CONFIGS } from './betTypes';
import type { RaceAnalysisData } from './multiRaceBets';
import { estimateMultiRacePayout } from './multiRacePayouts';

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Thresholds for ticket construction
 */
const TICKET_THRESHOLDS = {
  /** Minimum edge to consider a horse for SINGLE */
  SINGLE_MIN_EDGE: 100,
  /** Minimum rank for a horse to be included */
  MAX_HORSE_RANK: 6,
  /** Maximum horses in a SPREAD leg */
  MAX_SPREAD_HORSES: 4,
  /** Default spread size for CAUTION races */
  DEFAULT_SPREAD_SIZE: 3,
  /** Minimum spread size */
  MIN_SPREAD_SIZE: 2,
} as const;

/**
 * Risk style adjustments for ticket construction
 */
const RISK_STYLE_ADJUSTMENTS: Record<RiskStyle, {
  preferSingles: boolean;
  maxSpreadSize: number;
  includeLongshots: boolean;
}> = {
  safe: {
    preferSingles: false,
    maxSpreadSize: 4,
    includeLongshots: false,
  },
  balanced: {
    preferSingles: true,
    maxSpreadSize: 3,
    includeLongshots: true,
  },
  aggressive: {
    preferSingles: true,
    maxSpreadSize: 2,
    includeLongshots: true,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a unique ID for a multi-race bet
 */
function generateBetId(type: MultiRaceBetType, startRace: number): string {
  return `${type}_R${startRace}_${Date.now().toString(36)}`;
}

/**
 * Get top contenders from scored horses
 */
function getTopContenders(
  scoredHorses: ScoredHorse[],
  count: number = 4
): ScoredHorse[] {
  return scoredHorses
    .filter(h => !h.score.isScratched && h.rank <= TICKET_THRESHOLDS.MAX_HORSE_RANK)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, count);
}

/**
 * Determine the strategy for a leg based on race analysis
 */
function determineLegStrategy(
  valueAnalysis: RaceValueAnalysis,
  riskStyle: RiskStyle
): LegStrategy {
  const adjustments = RISK_STYLE_ADJUSTMENTS[riskStyle];

  // If we have a strong value play and prefer singles, use SINGLE
  if (
    valueAnalysis.primaryValuePlay &&
    valueAnalysis.primaryValuePlay.valueEdge >= TICKET_THRESHOLDS.SINGLE_MIN_EDGE &&
    adjustments.preferSingles
  ) {
    return 'SINGLE';
  }

  // Default to SPREAD
  return 'SPREAD';
}

/**
 * Select horses for a leg based on strategy
 */
function selectHorsesForLeg(
  scoredHorses: ScoredHorse[],
  valueAnalysis: RaceValueAnalysis,
  strategy: LegStrategy,
  riskStyle: RiskStyle
): { horses: ScoredHorse[]; valuePlayHorse?: number } {
  const adjustments = RISK_STYLE_ADJUSTMENTS[riskStyle];
  let valuePlayHorse: number | undefined;

  if (strategy === 'SINGLE') {
    // Use the primary value play
    const valuePlay = valueAnalysis.primaryValuePlay;
    if (valuePlay) {
      const horse = scoredHorses.find(h => h.horse.programNumber === valuePlay.programNumber);
      if (horse) {
        valuePlayHorse = valuePlay.programNumber;
        return { horses: [horse], valuePlayHorse };
      }
    }
    // Fallback to top contender
    const top = getTopContenders(scoredHorses, 1);
    return { horses: top };
  }

  // SPREAD strategy
  const maxSpread = adjustments.maxSpreadSize;
  let selectedHorses: ScoredHorse[] = [];

  // Start with value play if available
  if (valueAnalysis.primaryValuePlay) {
    const valueHorse = scoredHorses.find(
      h => h.horse.programNumber === valueAnalysis.primaryValuePlay!.programNumber
    );
    if (valueHorse) {
      selectedHorses.push(valueHorse);
      valuePlayHorse = valueAnalysis.primaryValuePlay.programNumber;
    }
  }

  // Add top contenders
  const contenders = getTopContenders(scoredHorses, 6);
  for (const contender of contenders) {
    if (selectedHorses.length >= maxSpread) break;
    if (!selectedHorses.some(h => h.index === contender.index)) {
      selectedHorses.push(contender);
    }
  }

  // Ensure minimum spread size
  if (selectedHorses.length < TICKET_THRESHOLDS.MIN_SPREAD_SIZE) {
    const additionalContenders = contenders.slice(0, TICKET_THRESHOLDS.MIN_SPREAD_SIZE);
    for (const c of additionalContenders) {
      if (!selectedHorses.some(h => h.index === c.index)) {
        selectedHorses.push(c);
      }
    }
  }

  // Sort by program number for display
  selectedHorses.sort((a, b) => a.horse.programNumber - b.horse.programNumber);

  return { horses: selectedHorses, valuePlayHorse };
}

/**
 * Generate reasoning for a leg
 */
function generateLegReasoning(
  strategy: LegStrategy,
  valuePlay: ValuePlay | null,
  horseCount: number
): string {
  if (strategy === 'SINGLE' && valuePlay) {
    return `${valuePlay.horseName} is a strong value play at +${Math.round(valuePlay.valueEdge)}% edge. Singling for max payout.`;
  }

  if (valuePlay) {
    return `Value play + ${horseCount - 1} contender${horseCount > 2 ? 's' : ''} for safety.`;
  }

  if (horseCount === 2) {
    return 'Using top 2 contenders.';
  }

  return `Competitive race, spreading to ${horseCount} contenders.`;
}

/**
 * Calculate total combinations for a ticket
 */
function calculateCombinations(legs: MultiRaceLeg[]): number {
  return legs.reduce((total, leg) => total * leg.horses.length, 1);
}

/**
 * Generate "what to say" script for betting window
 */
function generateWhatToSay(
  type: MultiRaceBetType,
  legs: MultiRaceLeg[],
  costPerCombo: number
): string {
  const config = MULTI_RACE_BET_CONFIGS[type];
  const startRace = legs[0]?.raceNumber ?? 1;
  const endRace = legs[legs.length - 1]?.raceNumber ?? 1;

  const lines: string[] = [];

  // Opening line
  const costStr = costPerCombo % 1 === 0 ? `$${costPerCombo}` : `${costPerCombo * 100} cent`;
  lines.push(`"${costStr} ${config.name}, races ${startRace} through ${endRace}:`);

  // Each leg
  legs.forEach((leg, idx) => {
    const horseNumbers = leg.horses.join(', ');
    const plural = leg.horses.length > 1 ? 's' : '';
    lines.push(` Leg ${idx + 1}: number${plural} ${horseNumbers}`);
  });

  // Close quote
  lines[lines.length - 1] += '"';

  return lines.join('\n');
}

/**
 * Generate explanation for the ticket
 */
function generateTicketExplanation(
  type: MultiRaceBetType,
  legs: MultiRaceLeg[],
  valuePlayCount: number,
  combinations: number
): string {
  const config = MULTI_RACE_BET_CONFIGS[type];

  if (valuePlayCount >= 2) {
    return `This ${config.name} has ${valuePlayCount} value plays in the sequence. Strong opportunity with ${combinations} combinations.`;
  }

  if (valuePlayCount === 1) {
    const valueLeg = legs.find(l => l.hasValuePlay);
    return valueLeg
      ? `Value play in Race ${valueLeg.raceNumber}. ${combinations} combinations across ${legs.length} races.`
      : `${combinations} combinations across ${legs.length} races.`;
  }

  return `${combinations} combinations. Spreading multiple races for coverage.`;
}

/**
 * Determine confidence level for a ticket
 */
function determineConfidence(
  _legs: MultiRaceLeg[],
  valuePlayCount: number,
  combinations: number
): MultiRaceConfidence {
  // HIGH: Multiple value plays, some singles, manageable combos
  if (valuePlayCount >= 2 && combinations <= 50) {
    return 'HIGH';
  }

  // MEDIUM: At least one value play or low combos
  if (valuePlayCount >= 1 || combinations <= 30) {
    return 'MEDIUM';
  }

  return 'LOW';
}

// ============================================================================
// MAIN CONSTRUCTION FUNCTION
// ============================================================================

/**
 * Build a multi-race ticket from an opportunity
 *
 * @param opportunity - The detected opportunity
 * @param races - Race analysis data for each race in the sequence
 * @param riskStyle - User's risk style
 * @param budget - Available budget for multi-race bets
 * @param costPerCombo - Cost per combination (or use default)
 * @returns Complete MultiRaceBet object
 */
export function buildMultiRaceTicket(
  opportunity: MultiRaceOpportunity,
  races: RaceAnalysisData[],
  riskStyle: RiskStyle,
  _budget: number,
  costPerCombo?: number
): MultiRaceBet {
  const config = MULTI_RACE_BET_CONFIGS[opportunity.type];
  const actualCostPerCombo = costPerCombo ?? config.defaultCostPerCombo;

  // Build each leg
  const legs: MultiRaceLeg[] = [];
  let valuePlayCount = 0;

  for (const raceNum of opportunity.races) {
    const raceData = races.find(r => r.raceNumber === raceNum);
    if (!raceData) continue;

    const strategy = determineLegStrategy(raceData.valueAnalysis, riskStyle);
    const { horses, valuePlayHorse } = selectHorsesForLeg(
      raceData.scoredHorses,
      raceData.valueAnalysis,
      strategy,
      riskStyle
    );

    const hasValuePlay = valuePlayHorse !== undefined;
    if (hasValuePlay) valuePlayCount++;

    const leg: MultiRaceLeg = {
      raceNumber: raceNum,
      horses: horses.map(h => h.horse.programNumber),
      horseNames: horses.map(h => h.horse.horseName),
      horseOdds: horses.map(h => h.horse.morningLineOdds),
      strategy,
      reasoning: generateLegReasoning(
        strategy,
        raceData.valueAnalysis.primaryValuePlay,
        horses.length
      ),
      hasValuePlay,
      valuePlayHorse,
    };

    legs.push(leg);
  }

  // Calculate combinations and cost
  const combinations = calculateCombinations(legs);
  const totalCost = combinations * actualCostPerCombo;

  // Estimate payout
  const potentialReturn = estimateMultiRacePayout(
    opportunity.type,
    legs,
    combinations
  );

  // Generate scripts
  const whatToSay = generateWhatToSay(opportunity.type, legs, actualCostPerCombo);
  const explanation = generateTicketExplanation(
    opportunity.type,
    legs,
    valuePlayCount,
    combinations
  );

  // Determine confidence
  const confidence = determineConfidence(legs, valuePlayCount, combinations);

  return {
    id: generateBetId(opportunity.type, legs[0]?.raceNumber ?? 1),
    type: opportunity.type,
    startingRace: legs[0]?.raceNumber ?? 1,
    endingRace: legs[legs.length - 1]?.raceNumber ?? 1,
    legs,
    combinations,
    costPerCombo: actualCostPerCombo,
    totalCost,
    potentialReturn,
    confidence,
    whatToSay,
    explanation,
    quality: opportunity.quality,
    valuePlayCount,
    isSelected: false,
  };
}

/**
 * Build tickets for all opportunities
 */
export function buildAllTickets(
  opportunities: MultiRaceOpportunity[],
  races: RaceAnalysisData[],
  riskStyle: RiskStyle,
  budget: number
): MultiRaceBet[] {
  return opportunities.map(opp =>
    buildMultiRaceTicket(opp, races, riskStyle, budget)
  );
}

/**
 * Adjust ticket to fit budget by reducing spreads
 */
export function adjustTicketToBudget(
  ticket: MultiRaceBet,
  maxBudget: number
): MultiRaceBet {
  if (ticket.totalCost <= maxBudget) {
    return ticket;
  }

  // Try reducing spreads one by one starting from largest
  const adjustedLegs = [...ticket.legs].sort(
    (a, b) => b.horses.length - a.horses.length
  );

  const newLegs: MultiRaceLeg[] = ticket.legs.map(leg => ({ ...leg }));

  for (let i = 0; i < adjustedLegs.length; i++) {
    const legIndex = ticket.legs.findIndex(l => l.raceNumber === adjustedLegs[i]?.raceNumber);
    const leg = newLegs[legIndex];
    if (!leg) continue;

    // Don't reduce singles
    if (leg.horses.length <= 1) continue;

    // Reduce by one horse at a time
    while (leg.horses.length > 1) {
      // Remove the last horse (usually lowest ranked)
      leg.horses = leg.horses.slice(0, -1);
      leg.horseNames = leg.horseNames.slice(0, -1);
      leg.horseOdds = leg.horseOdds.slice(0, -1);

      // Recalculate
      const newCombos = calculateCombinations(newLegs);
      const newCost = newCombos * ticket.costPerCombo;

      if (newCost <= maxBudget) {
        // Update and return
        return {
          ...ticket,
          legs: newLegs,
          combinations: newCombos,
          totalCost: newCost,
          whatToSay: generateWhatToSay(ticket.type, newLegs, ticket.costPerCombo),
        };
      }
    }
  }

  // If we still can't fit, return original (user will see warning)
  return ticket;
}

/**
 * Update a specific leg in a ticket (for customization)
 */
export function updateTicketLeg(
  ticket: MultiRaceBet,
  raceNumber: number,
  newHorses: number[],
  newHorseNames: string[],
  newHorseOdds: string[]
): MultiRaceBet {
  const legIndex = ticket.legs.findIndex(l => l.raceNumber === raceNumber);
  if (legIndex === -1) return ticket;

  const newLegs = [...ticket.legs];
  const oldLeg = newLegs[legIndex];
  if (!oldLeg) return ticket;

  newLegs[legIndex] = {
    ...oldLeg,
    horses: newHorses,
    horseNames: newHorseNames,
    horseOdds: newHorseOdds,
    strategy: newHorses.length === 1 ? 'SINGLE' : 'SPREAD',
    reasoning: newHorses.length === 1 ? 'User selected single' : `User selected ${newHorses.length} horses`,
  };

  const newCombos = calculateCombinations(newLegs);
  const newCost = newCombos * ticket.costPerCombo;

  return {
    ...ticket,
    legs: newLegs,
    combinations: newCombos,
    totalCost: newCost,
    whatToSay: generateWhatToSay(ticket.type, newLegs, ticket.costPerCombo),
  };
}

/**
 * Get combination math string for display (e.g., "1 x 2 x 3 x 4 = 24")
 */
export function getCombinationMath(legs: MultiRaceLeg[]): string {
  const horseCounts = legs.map(l => l.horses.length);
  const product = horseCounts.reduce((a, b) => a * b, 1);
  return `${horseCounts.join(' x ')} = ${product}`;
}

/**
 * Format horse list for a leg (e.g., "#1, #3, #5")
 */
export function formatLegHorses(leg: MultiRaceLeg): string {
  return leg.horses.map(h => `#${h}`).join(', ');
}

/**
 * Format horse list with names (e.g., "#1 SPEEDY (3-1), #3 ROCKET (8-1)")
 */
export function formatLegHorsesWithNames(leg: MultiRaceLeg): string {
  return leg.horses.map((h, i) => {
    const name = leg.horseNames[i] || 'Unknown';
    const odds = leg.horseOdds[i] || '';
    return `#${h} ${name}${odds ? ` (${odds})` : ''}`;
  }).join(', ');
}
