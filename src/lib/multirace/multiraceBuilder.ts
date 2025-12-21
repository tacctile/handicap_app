/**
 * Multi-Race Ticket Builder
 *
 * Interactive ticket building with:
 * - Race-by-race selection interface
 * - Live cost calculation
 * - Smart suggestions
 * - Budget constraints
 * - Auto-optimization
 */

import { validateNumber } from '../sanitization';
import {
  type MultiRaceBetType,
  type MultiRaceStrategy,
  type MultiRaceRaceData,
  type RaceSelection,
  type TicketBuilderState,
  type LegSuggestion,
  type OptimizedTicket,
  type CarryoverInfo,
  type MultiRaceTicketDisplay,
  type MultiRaceCost,
  getBetConfig,
} from './multiraceTypes';
import {
  calculateMultiRaceCost,
  generateWindowInstruction,
  findOptimalBaseBet,
} from './multiraceCalculator';
import {
  classifyRaceStrength,
  findStandoutHorse,
  calculateTicketProbability,
  estimatePayoutRange,
  calculateExpectedValue,
} from './multiraceOptimizer';
import { getCarryover } from './carryoverTracker';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Score thresholds for suggestions */
const SUGGESTION_THRESHOLDS = {
  singleCandidate: 180,
  strongContender: 160,
  valuePlay: 140,
};

// ============================================================================
// BUILDER STATE MANAGEMENT
// ============================================================================

/**
 * Create initial builder state
 */
export function createBuilderState(
  betType: MultiRaceBetType,
  startingRace: number,
  races: MultiRaceRaceData[],
  budget: number = 50,
  trackCode?: string
): TicketBuilderState {
  const config = getBetConfig(betType);

  // Create empty selections for each leg
  const selections: RaceSelection[] = races.slice(0, config.racesRequired).map((race, idx) => ({
    raceNumber: race.raceNumber,
    legNumber: idx + 1,
    selections: [],
    isAllSelected: false,
    fieldSize: race.fieldSize,
    raceStrength: classifyRaceStrength(race.horses),
  }));

  // Check for carryover
  let carryover: CarryoverInfo | undefined;
  if (trackCode && (betType === 'pick_5' || betType === 'pick_6')) {
    const stored = getCarryover(trackCode, betType);
    if (stored) {
      carryover = stored;
    }
  }

  return {
    betType,
    startingRace,
    selections,
    baseBet: config.defaultBaseBet,
    liveCost: null,
    liveProbability: 0,
    budget,
    isAutoOptimizing: false,
    strategy: 'balanced',
    errors: [],
    carryover,
  };
}

/**
 * Update selection for a specific leg
 */
export function updateLegSelection(
  state: TicketBuilderState,
  legNumber: number,
  horses: number[],
  isAll: boolean = false
): TicketBuilderState {
  const newSelections = state.selections.map((sel) => {
    if (sel.legNumber === legNumber) {
      return {
        ...sel,
        selections: isAll ? Array.from({ length: sel.fieldSize }, (_, i) => i + 1) : horses,
        isAllSelected: isAll,
      };
    }
    return sel;
  });

  return recalculateCosts({
    ...state,
    selections: newSelections,
  });
}

/**
 * Toggle a single horse in a leg
 */
export function toggleHorseInLeg(
  state: TicketBuilderState,
  legNumber: number,
  programNumber: number
): TicketBuilderState {
  const newSelections = state.selections.map((sel) => {
    if (sel.legNumber === legNumber) {
      const currentSelections = sel.selections;
      const isSelected = currentSelections.includes(programNumber);

      return {
        ...sel,
        selections: isSelected
          ? currentSelections.filter((n) => n !== programNumber)
          : [...currentSelections, programNumber].sort((a, b) => a - b),
        isAllSelected: false,
      };
    }
    return sel;
  });

  return recalculateCosts({
    ...state,
    selections: newSelections,
  });
}

/**
 * Toggle "All" for a leg
 */
export function toggleAllForLeg(state: TicketBuilderState, legNumber: number): TicketBuilderState {
  const leg = state.selections.find((s) => s.legNumber === legNumber);
  if (!leg) return state;

  return updateLegSelection(
    state,
    legNumber,
    leg.isAllSelected ? [] : Array.from({ length: leg.fieldSize }, (_, i) => i + 1),
    !leg.isAllSelected
  );
}

/**
 * Update base bet amount
 */
export function updateBaseBet(state: TicketBuilderState, baseBet: number): TicketBuilderState {
  const config = getBetConfig(state.betType);
  const validated = validateNumber(baseBet, config.defaultBaseBet, {
    min: config.minBaseBet,
    max: 100,
  });

  return recalculateCosts({
    ...state,
    baseBet: validated,
  });
}

/**
 * Update budget
 */
export function updateBudget(state: TicketBuilderState, budget: number): TicketBuilderState {
  const validated = validateNumber(budget, 50, { min: 1, max: 10000 });

  return {
    ...state,
    budget: validated,
  };
}

/**
 * Update strategy
 */
export function updateStrategy(
  state: TicketBuilderState,
  strategy: MultiRaceStrategy
): TicketBuilderState {
  return {
    ...state,
    strategy,
  };
}

// ============================================================================
// COST CALCULATION
// ============================================================================

/**
 * Recalculate costs and probability
 */
function recalculateCosts(state: TicketBuilderState): TicketBuilderState {
  const errors: string[] = [];

  // Check if all legs have at least one selection
  const emptyLegs = state.selections.filter((s) => s.selections.length === 0);
  if (emptyLegs.length > 0) {
    errors.push(`Select horses for race(s) ${emptyLegs.map((l) => l.raceNumber).join(', ')}`);
  }

  // Calculate cost if all legs have selections
  let liveCost: MultiRaceCost | null = null;
  if (emptyLegs.length === 0) {
    liveCost = calculateMultiRaceCost({
      betType: state.betType,
      selections: state.selections,
      baseBet: state.baseBet,
    });

    if (!liveCost.isValid && liveCost.error) {
      errors.push(liveCost.error);
    }

    // Check budget
    if (liveCost.isValid && liveCost.total > state.budget) {
      errors.push(
        `Ticket cost $${liveCost.total.toFixed(2)} exceeds budget $${state.budget.toFixed(2)}`
      );
    }
  }

  return {
    ...state,
    liveCost,
    errors,
  };
}

// ============================================================================
// SUGGESTIONS
// ============================================================================

/**
 * Generate suggestion for a race leg
 */
export function generateLegSuggestion(
  race: MultiRaceRaceData,
  strategy: MultiRaceStrategy
): LegSuggestion {
  const strength = classifyRaceStrength(race.horses);
  const standout = findStandoutHorse(race.horses);

  if (standout && strength === 'standout') {
    return {
      raceNumber: race.raceNumber,
      action: 'single',
      horses: [standout.programNumber],
      reason: `Single this race - clear favorite (#${standout.programNumber} at ${standout.score} pts)`,
      icon: 'verified',
    };
  }

  if (strength === 'competitive') {
    const strongHorses = race.horses
      .filter((h) => h.score >= SUGGESTION_THRESHOLDS.strongContender)
      .slice(0, strategy === 'conservative' ? 2 : 3)
      .map((h) => h.programNumber);

    return {
      raceNumber: race.raceNumber,
      action: 'spread',
      horses: strongHorses,
      reason: `Spread here - competitive race (${strongHorses.length} horses 160+)`,
      icon: 'multiple_stop',
    };
  }

  // Weak race
  if (strategy === 'aggressive') {
    return {
      raceNumber: race.raceNumber,
      action: 'use_all',
      horses: race.horses.map((h) => h.programNumber),
      reason: 'Use All - weak race, no standout',
      icon: 'select_all',
    };
  }

  const topHorses = race.horses
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((h) => h.programNumber);

  return {
    raceNumber: race.raceNumber,
    action: 'spread',
    horses: topHorses,
    reason: 'Spread wide - weak race, no standout',
    icon: 'scatter_plot',
  };
}

/**
 * Generate all suggestions for current state
 */
export function generateAllSuggestions(
  state: TicketBuilderState,
  races: MultiRaceRaceData[]
): LegSuggestion[] {
  return races
    .slice(0, state.selections.length)
    .map((race) => generateLegSuggestion(race, state.strategy));
}

/**
 * Apply suggestion to a leg
 */
export function applySuggestion(
  state: TicketBuilderState,
  suggestion: LegSuggestion
): TicketBuilderState {
  const leg = state.selections.find((s) => s.raceNumber === suggestion.raceNumber);
  if (!leg) return state;

  return updateLegSelection(
    state,
    leg.legNumber,
    suggestion.horses,
    suggestion.action === 'use_all'
  );
}

/**
 * Apply all suggestions
 */
export function applyAllSuggestions(
  state: TicketBuilderState,
  races: MultiRaceRaceData[]
): TicketBuilderState {
  const suggestions = generateAllSuggestions(state, races);
  let newState = state;

  for (const suggestion of suggestions) {
    newState = applySuggestion(newState, suggestion);
  }

  return newState;
}

// ============================================================================
// AUTO-OPTIMIZATION
// ============================================================================

/**
 * Auto-optimize ticket to fit budget
 */
export function autoOptimizeForBudget(
  state: TicketBuilderState,
  races: MultiRaceRaceData[]
): TicketBuilderState {
  // Start with suggestions
  const optimizedState = applyAllSuggestions(state, races);

  // Check if it fits budget
  if (optimizedState.liveCost && optimizedState.liveCost.total <= state.budget) {
    return optimizedState;
  }

  // Try reducing selections
  const selectionsPerRace = optimizedState.selections.map((s) => s.selections.length);
  const { baseBet, fits } = findOptimalBaseBet(state.betType, selectionsPerRace, state.budget);

  if (fits) {
    return updateBaseBet(optimizedState, baseBet);
  }

  // Still too expensive - reduce to singles where possible
  const config = getBetConfig(state.betType);
  const newSelections = [...optimizedState.selections];

  for (let i = 0; i < newSelections.length; i++) {
    const race = races[i];
    const selection = newSelections[i];
    if (!race || !selection) continue;

    const standout = findStandoutHorse(race.horses);
    if (standout) {
      newSelections[i] = {
        ...selection,
        selections: [standout.programNumber],
        isAllSelected: false,
      };
    } else {
      // Take just top 2
      const topTwo = race.horses
        .sort((a, b) => b.score - a.score)
        .slice(0, 2)
        .map((h) => h.programNumber);
      newSelections[i] = {
        ...selection,
        selections: topTwo,
        isAllSelected: false,
      };
    }
  }

  return recalculateCosts({
    ...optimizedState,
    selections: newSelections,
    baseBet: config.minBaseBet,
    isAutoOptimizing: true,
  });
}

// ============================================================================
// TICKET BUILDING
// ============================================================================

/**
 * Build final ticket from state
 */
export function buildTicketFromState(
  state: TicketBuilderState,
  races: MultiRaceRaceData[]
): OptimizedTicket | null {
  if (!state.liveCost || !state.liveCost.isValid) {
    return null;
  }

  if (state.errors.length > 0) {
    return null;
  }

  const config = getBetConfig(state.betType);
  const probability = calculateTicketProbability(races, state.selections);
  const payoutRange = estimatePayoutRange(state.betType, state.liveCost, probability);
  const expectedValue = calculateExpectedValue(
    probability,
    payoutRange.likely,
    state.liveCost.total
  );

  const endRace = state.startingRace + config.racesRequired - 1;
  const windowInstruction = generateWindowInstruction(
    state.betType,
    state.startingRace,
    state.selections.map((s) => ({
      raceNumber: s.raceNumber,
      horses: s.selections,
    })),
    state.baseBet
  );

  return {
    id: `${state.betType}-${state.startingRace}-${Date.now()}`,
    betType: state.betType,
    selections: state.selections,
    cost: state.liveCost,
    probability,
    payoutRange,
    expectedValue,
    strategy: state.strategy,
    isRecommended: true,
    reasoning: `${config.displayName} using ${state.liveCost.spreadNotation} for $${state.liveCost.total.toFixed(2)}`,
    windowInstruction,
    raceRange: `${state.startingRace}-${endRace}`,
  };
}

// ============================================================================
// BET SLIP CONVERSION
// ============================================================================

/**
 * Convert ticket to bet slip display format
 */
export function convertToTicketDisplay(ticket: OptimizedTicket): MultiRaceTicketDisplay {
  const config = getBetConfig(ticket.betType);

  return {
    id: ticket.id,
    betType: ticket.betType,
    displayName: `${config.displayName} (Races ${ticket.raceRange})`,
    spreadNotation: ticket.cost.spreadNotation,
    totalCost: ticket.cost.total,
    probabilityPercent: ticket.probability * 100,
    payoutRange: {
      min: ticket.payoutRange.min,
      max: ticket.payoutRange.max,
    },
    expectedValue: ticket.expectedValue,
    raceInstructions: ticket.selections.map((sel) => ({
      raceNumber: sel.raceNumber,
      horses: sel.selections,
      displayText: sel.isAllSelected ? 'ALL' : sel.selections.join(', '),
    })),
    windowInstruction: ticket.windowInstruction,
    hasCarryover: false,
  };
}

/**
 * Format ticket for window instructions
 */
export function formatTicketForWindow(ticket: OptimizedTicket): string {
  return ticket.windowInstruction;
}

/**
 * Format ticket for clipboard
 */
export function formatTicketForClipboard(ticket: OptimizedTicket): string {
  const config = getBetConfig(ticket.betType);
  const lines = [
    `${config.displayName} - Races ${ticket.raceRange}`,
    `Cost: $${ticket.cost.total.toFixed(2)} (${ticket.cost.combinations} combos)`,
    `Probability: ${(ticket.probability * 100).toFixed(1)}%`,
    `Payout Range: $${ticket.payoutRange.min} - $${ticket.payoutRange.max}`,
    `EV: ${ticket.expectedValue >= 0 ? '+' : ''}$${ticket.expectedValue.toFixed(2)}`,
    '',
    'Window Instructions:',
    ticket.windowInstruction,
  ];

  return lines.join('\n');
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate builder state before building ticket
 */
export function validateBuilderState(state: TicketBuilderState): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config = getBetConfig(state.betType);

  // Check all legs have selections
  for (const sel of state.selections) {
    if (sel.selections.length === 0) {
      errors.push(`Race ${sel.raceNumber} has no selections`);
    }
  }

  // Check race count
  if (state.selections.length !== config.racesRequired) {
    errors.push(`${config.displayName} requires ${config.racesRequired} races`);
  }

  // Check cost
  if (state.liveCost) {
    if (!state.liveCost.isValid && state.liveCost.error) {
      errors.push(state.liveCost.error);
    }

    if (state.liveCost.total > state.budget) {
      errors.push(
        `Ticket cost ($${state.liveCost.total.toFixed(2)}) exceeds budget ($${state.budget.toFixed(2)})`
      );
    }

    // Warnings
    if (state.liveCost.total > state.budget * 0.8) {
      warnings.push('Ticket uses most of your budget');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================================================
// DISPLAY HELPERS
// ============================================================================

/**
 * Get summary text for current state
 */
export function getStateSummary(state: TicketBuilderState): string {
  const config = getBetConfig(state.betType);

  if (!state.liveCost || !state.liveCost.isValid) {
    const emptyLegs = state.selections.filter((s) => s.selections.length === 0);
    if (emptyLegs.length > 0) {
      return `Select horses for ${emptyLegs.length} more race(s)`;
    }
    return 'Building ticket...';
  }

  const { spreadNotation, total, combinations } = state.liveCost;
  return `${config.shortName} ${spreadNotation} = $${total.toFixed(2)} (${combinations} combos)`;
}

/**
 * Get color for probability display
 */
export function getProbabilityColor(probability: number): string {
  if (probability >= 0.15) return '#22c55e'; // Green - good
  if (probability >= 0.05) return '#eab308'; // Yellow - moderate
  return '#ef4444'; // Red - low
}

/**
 * Get color for EV display
 */
export function getEVColor(ev: number): string {
  if (ev > 0) return '#22c55e';
  if (ev > -5) return '#eab308';
  return '#ef4444';
}

/**
 * Format probability for display
 */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

/**
 * Format EV for display
 */
export function formatEV(ev: number): string {
  const sign = ev >= 0 ? '+' : '';
  return `${sign}$${ev.toFixed(2)}`;
}
