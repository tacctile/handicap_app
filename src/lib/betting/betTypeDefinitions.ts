/**
 * Bet Type Definitions and Combination Calculator
 *
 * Defines all exotic bet types and provides accurate combination math
 * for the Bet Builder single-screen interface.
 */

// ============================================================================
// BET TYPE DEFINITIONS
// ============================================================================

/**
 * Extended bet types for the Bet Builder interface
 */
export type BuilderBetType =
  | 'WIN'
  | 'PLACE'
  | 'SHOW'
  | 'EXACTA'
  | 'EXACTA_BOX'
  | 'EXACTA_KEY'
  | 'TRIFECTA'
  | 'TRIFECTA_BOX'
  | 'TRIFECTA_KEY'
  | 'SUPERFECTA'
  | 'SUPERFECTA_BOX'
  | 'QUINELLA'
  | 'DAILY_DOUBLE'
  | 'PICK_3'
  | 'PICK_4';

/**
 * Risk style for bet selection
 */
export type BuilderRiskStyle = 'safe' | 'balanced' | 'aggressive';

/**
 * Metadata for each bet type
 */
export interface BetTypeMetadata {
  name: string;
  displayName: string;
  shortName: string;
  minHorses: number;
  maxHorses: number;
  allowsBox: boolean;
  allowsKey: boolean;
  isMultiRace: boolean;
  raceCount: number;
  baseCost: number;
  description: string;
  whatItMeans: string;
  winCondition: string;
}

/**
 * Complete bet type configuration
 */
export const BET_TYPE_CONFIG: Record<BuilderBetType, BetTypeMetadata> = {
  WIN: {
    name: 'WIN',
    displayName: 'Win',
    shortName: 'W',
    minHorses: 1,
    maxHorses: 1,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 2,
    description: 'Your horse must finish first.',
    whatItMeans: "You're betting that your selected horse will win the race.",
    winCondition: 'Horse finishes 1st',
  },
  PLACE: {
    name: 'PLACE',
    displayName: 'Place',
    shortName: 'P',
    minHorses: 1,
    maxHorses: 1,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 2,
    description: 'Your horse must finish 1st or 2nd.',
    whatItMeans: "You're betting your horse will finish in the top 2. Pays less than Win but more likely to hit.",
    winCondition: 'Horse finishes 1st or 2nd',
  },
  SHOW: {
    name: 'SHOW',
    displayName: 'Show',
    shortName: 'S',
    minHorses: 1,
    maxHorses: 1,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 2,
    description: 'Your horse must finish 1st, 2nd, or 3rd.',
    whatItMeans: "You're betting your horse will hit the board (top 3). Lowest payout but highest probability.",
    winCondition: 'Horse finishes 1st, 2nd, or 3rd',
  },
  EXACTA: {
    name: 'EXACTA',
    displayName: 'Exacta',
    shortName: 'EX',
    minHorses: 2,
    maxHorses: 2,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 2,
    description: 'Pick the 1st and 2nd place finishers in exact order.',
    whatItMeans: "You're betting horse A wins and horse B finishes second. Order matters!",
    winCondition: '1st and 2nd in exact order',
  },
  EXACTA_BOX: {
    name: 'EXACTA_BOX',
    displayName: 'Exacta Box',
    shortName: 'EX BOX',
    minHorses: 2,
    maxHorses: 8,
    allowsBox: true,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 2,
    description: 'Pick horses to finish 1st and 2nd in any order.',
    whatItMeans: "You're betting any two of your horses finish 1-2 in either order. Costs more but more flexible.",
    winCondition: 'Any two selected horses finish 1-2',
  },
  EXACTA_KEY: {
    name: 'EXACTA_KEY',
    displayName: 'Exacta Key',
    shortName: 'EX KEY',
    minHorses: 2,
    maxHorses: 8,
    allowsBox: false,
    allowsKey: true,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 2,
    description: 'Your key horse wins, others can finish 2nd.',
    whatItMeans: "You're betting your key horse wins, with any of the other horses finishing second.",
    winCondition: 'Key horse 1st, any other 2nd',
  },
  TRIFECTA: {
    name: 'TRIFECTA',
    displayName: 'Trifecta',
    shortName: 'TRI',
    minHorses: 3,
    maxHorses: 3,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 1,
    description: 'Pick the 1st, 2nd, and 3rd place finishers in exact order.',
    whatItMeans: "You're betting on the exact 1-2-3 finish order. Harder to hit but bigger payouts.",
    winCondition: '1st, 2nd, 3rd in exact order',
  },
  TRIFECTA_BOX: {
    name: 'TRIFECTA_BOX',
    displayName: 'Trifecta Box',
    shortName: 'TRI BOX',
    minHorses: 3,
    maxHorses: 8,
    allowsBox: true,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 1,
    description: 'Pick horses to finish 1st, 2nd, and 3rd in any order.',
    whatItMeans: "You're betting any three of your horses finish 1-2-3 in any order.",
    winCondition: 'Any three selected horses finish 1-2-3',
  },
  TRIFECTA_KEY: {
    name: 'TRIFECTA_KEY',
    displayName: 'Trifecta Key',
    shortName: 'TRI KEY',
    minHorses: 3,
    maxHorses: 8,
    allowsBox: false,
    allowsKey: true,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 1,
    description: 'Your key horse in top 3, others fill remaining spots.',
    whatItMeans: "You're betting your key horse finishes top 3, with others filling the remaining spots.",
    winCondition: 'Key horse top 3, others fill 1-2-3',
  },
  SUPERFECTA: {
    name: 'SUPERFECTA',
    displayName: 'Superfecta',
    shortName: 'SUPER',
    minHorses: 4,
    maxHorses: 4,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 0.1,
    description: 'Pick the 1st, 2nd, 3rd, and 4th place finishers in exact order.',
    whatItMeans: "You're betting on the exact 1-2-3-4 finish order. Very hard but massive payouts.",
    winCondition: '1st, 2nd, 3rd, 4th in exact order',
  },
  SUPERFECTA_BOX: {
    name: 'SUPERFECTA_BOX',
    displayName: 'Superfecta Box',
    shortName: 'SUPER BOX',
    minHorses: 4,
    maxHorses: 8,
    allowsBox: true,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 0.1,
    description: 'Pick horses to finish 1st, 2nd, 3rd, and 4th in any order.',
    whatItMeans: "You're betting any four of your horses finish 1-2-3-4 in any order.",
    winCondition: 'Any four selected horses finish 1-2-3-4',
  },
  QUINELLA: {
    name: 'QUINELLA',
    displayName: 'Quinella',
    shortName: 'QUI',
    minHorses: 2,
    maxHorses: 2,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: false,
    raceCount: 1,
    baseCost: 2,
    description: 'Pick two horses to finish 1st and 2nd in either order.',
    whatItMeans: "Like an Exacta Box with 2 horses, but usually at a lower cost. Your two horses just need to finish 1-2.",
    winCondition: 'Two horses finish 1-2 in either order',
  },
  DAILY_DOUBLE: {
    name: 'DAILY_DOUBLE',
    displayName: 'Daily Double',
    shortName: 'DD',
    minHorses: 1,
    maxHorses: 1,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: true,
    raceCount: 2,
    baseCost: 2,
    description: 'Pick the winner of two consecutive races.',
    whatItMeans: "You're betting on the winner of this race AND the next race. Both must win.",
    winCondition: 'Winners of 2 consecutive races',
  },
  PICK_3: {
    name: 'PICK_3',
    displayName: 'Pick 3',
    shortName: 'P3',
    minHorses: 1,
    maxHorses: 1,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: true,
    raceCount: 3,
    baseCost: 1,
    description: 'Pick the winner of three consecutive races.',
    whatItMeans: "You're betting on the winner of 3 races in a row. All three must win.",
    winCondition: 'Winners of 3 consecutive races',
  },
  PICK_4: {
    name: 'PICK_4',
    displayName: 'Pick 4',
    shortName: 'P4',
    minHorses: 1,
    maxHorses: 1,
    allowsBox: false,
    allowsKey: false,
    isMultiRace: true,
    raceCount: 4,
    baseCost: 0.5,
    description: 'Pick the winner of four consecutive races.',
    whatItMeans: "You're betting on the winner of 4 races in a row. All four must win.",
    winCondition: 'Winners of 4 consecutive races',
  },
};

// ============================================================================
// COMBINATION CALCULATOR
// ============================================================================

/**
 * Calculate factorial for combination math
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Calculate permutations P(n, r) = n! / (n-r)!
 */
function permutations(n: number, r: number): number {
  if (n < r) return 0;
  return factorial(n) / factorial(n - r);
}

/**
 * Calculate number of combinations for a bet type
 */
export function calculateCombinations(betType: BuilderBetType, horseCount: number): number {
  switch (betType) {
    case 'WIN':
    case 'PLACE':
    case 'SHOW':
      return 1;

    case 'EXACTA':
      return 1; // Straight exacta = 1 combination

    case 'EXACTA_BOX':
      // n horses: n × (n-1) = permutations
      return horseCount * (horseCount - 1);

    case 'EXACTA_KEY':
      // 1 key horse over n-1 others
      return horseCount - 1;

    case 'QUINELLA':
      // n choose 2, any order (1 combination for 2 horses)
      return 1;

    case 'TRIFECTA':
      return 1; // Straight trifecta = 1 combination

    case 'TRIFECTA_BOX':
      // n horses: n × (n-1) × (n-2) = P(n, 3)
      if (horseCount < 3) return 0;
      return permutations(horseCount, 3);

    case 'TRIFECTA_KEY':
      // Key in 1st: (n-1) × (n-2) combinations for 2nd/3rd
      // Or key ALL (any position): 3 × P(n-1, 2)
      // Standard: key in 1st position
      if (horseCount < 3) return 0;
      return (horseCount - 1) * (horseCount - 2);

    case 'SUPERFECTA':
      return 1; // Straight superfecta = 1 combination

    case 'SUPERFECTA_BOX':
      // n horses: n × (n-1) × (n-2) × (n-3) = P(n, 4)
      if (horseCount < 4) return 0;
      return permutations(horseCount, 4);

    case 'DAILY_DOUBLE':
    case 'PICK_3':
    case 'PICK_4':
      // Multi-race bets: just 1 combination per horse selection
      return 1;

    default:
      return 1;
  }
}

/**
 * Calculate total cost for a bet
 */
export function calculateTotalCost(
  betType: BuilderBetType,
  horseCount: number,
  perWayAmount: number
): number {
  const combinations = calculateCombinations(betType, horseCount);
  return combinations * perWayAmount;
}

/**
 * Get the number of horses required for a bet type
 */
export function getRequiredHorses(betType: BuilderBetType): { min: number; max: number } {
  const config = BET_TYPE_CONFIG[betType];
  return { min: config.minHorses, max: config.maxHorses };
}

/**
 * Format bet for window script
 */
export function formatWindowScript(
  betType: BuilderBetType,
  horses: number[],
  amount: number
): string {
  const sortedHorses = [...horses].sort((a, b) => a - b);
  const horseList = sortedHorses.join('-');

  switch (betType) {
    case 'WIN':
      return `$${amount} WIN, ${horses[0]}`;
    case 'PLACE':
      return `$${amount} PLACE, ${horses[0]}`;
    case 'SHOW':
      return `$${amount} SHOW, ${horses[0]}`;
    case 'EXACTA':
      return `$${amount} EXACTA, ${horses[0]} over ${horses[1]}`;
    case 'EXACTA_BOX':
      return `$${amount} EXACTA BOX, ${horseList}`;
    case 'EXACTA_KEY':
      return `$${amount} EXACTA, ${horses[0]} over ${horses.slice(1).join(', ')}`;
    case 'QUINELLA':
      return `$${amount} QUINELLA, ${horseList}`;
    case 'TRIFECTA':
      return `$${amount} TRIFECTA, ${horses.join('-')}`;
    case 'TRIFECTA_BOX':
      return `$${amount} TRIFECTA BOX, ${horseList}`;
    case 'TRIFECTA_KEY':
      return `$${amount} TRIFECTA KEY, ${horses[0]} WITH ${horses.slice(1).join('-')}`;
    case 'SUPERFECTA':
      return `$${amount} SUPERFECTA, ${horses.join('-')}`;
    case 'SUPERFECTA_BOX':
      return `$${amount} SUPERFECTA BOX, ${horseList}`;
    case 'DAILY_DOUBLE':
      return `$${amount} DAILY DOUBLE, ${horses.join('-')}`;
    case 'PICK_3':
      return `$${amount} PICK 3, ${horses.join('-')}`;
    case 'PICK_4':
      return `$${amount} PICK 4, ${horses.join('-')}`;
    default:
      return `$${amount} ${betType}, ${horseList}`;
  }
}

/**
 * Get explanation text for a bet type
 */
export function getBetTypeExplanation(betType: BuilderBetType, horseCount: number): string {
  const combos = calculateCombinations(betType, horseCount);

  switch (betType) {
    case 'WIN':
      return "You're betting your horse wins the race outright.";
    case 'PLACE':
      return "You're betting your horse finishes 1st or 2nd. Safer than Win, lower payout.";
    case 'SHOW':
      return "You're betting your horse finishes in the top 3. Safest straight bet.";
    case 'EXACTA':
      return "You're betting on the exact 1-2 finish order. Your first horse must win, second must place.";
    case 'EXACTA_BOX':
      return `You're betting that any two of your ${horseCount} horses finish 1-2 in either order. With ${horseCount} horses: ${combos} combinations (${getExactaBoxExplanation(horseCount)}).`;
    case 'EXACTA_KEY':
      return `Your key horse must win, with any of the other ${horseCount - 1} horses finishing second.`;
    case 'QUINELLA':
      return "Like an Exacta Box with 2 horses. Your two horses just need to finish 1-2 in any order.";
    case 'TRIFECTA':
      return "You're betting on the exact 1-2-3 finish order. Hard to hit but big payouts.";
    case 'TRIFECTA_BOX':
      return `You're betting that any three of your ${horseCount} horses finish 1-2-3 in any order. With ${horseCount} horses: ${combos} combinations.`;
    case 'TRIFECTA_KEY':
      return `Your key horse must finish in the top 3, with the others filling the remaining spots. ${combos} combinations.`;
    case 'SUPERFECTA':
      return "You're betting on the exact 1-2-3-4 finish order. Very difficult but life-changing payouts.";
    case 'SUPERFECTA_BOX':
      return `You're betting that any four of your ${horseCount} horses finish 1-2-3-4 in any order. With ${horseCount} horses: ${combos} combinations.`;
    case 'DAILY_DOUBLE':
      return "You're betting on the winner of this race AND the next race. Both must win.";
    case 'PICK_3':
      return "You're betting on the winners of 3 consecutive races. All three must win.";
    case 'PICK_4':
      return "You're betting on the winners of 4 consecutive races. All four must win.";
    default:
      return "";
  }
}

/**
 * Helper to explain Exacta Box combinations
 */
function getExactaBoxExplanation(n: number): string {
  if (n === 2) return 'A-B or B-A';
  if (n === 3) return 'any pairing of 3';
  if (n === 4) return 'any pairing of 4';
  return `${n}x${n - 1} orderings`;
}

/**
 * Get value label for a horse's edge
 */
export function getValueLabel(edge: number): { label: string; color: string; icon: string } {
  if (edge >= 50) {
    return { label: 'BETTER THAN ODDS SUGGEST', color: '#10b981', icon: '🔥' };
  }
  if (edge >= 0) {
    return { label: 'FAIR VALUE HORSE', color: '#6B7280', icon: '' };
  }
  if (edge >= -25) {
    return { label: 'SLIGHT UNDERLAY', color: '#f59e0b', icon: '' };
  }
  return { label: 'OVERBET BY PUBLIC', color: '#ef4444', icon: '⚠️' };
}

/**
 * Dropdown options for bet types
 */
export const BET_TYPE_OPTIONS: { value: BuilderBetType; label: string; group: string }[] = [
  // Straight Bets
  { value: 'WIN', label: 'Win', group: 'Straight Bets' },
  { value: 'PLACE', label: 'Place', group: 'Straight Bets' },
  { value: 'SHOW', label: 'Show', group: 'Straight Bets' },
  // Exacta
  { value: 'EXACTA', label: 'Exacta', group: 'Exotic Bets' },
  { value: 'EXACTA_BOX', label: 'Exacta Box', group: 'Exotic Bets' },
  { value: 'EXACTA_KEY', label: 'Exacta Key', group: 'Exotic Bets' },
  // Trifecta
  { value: 'TRIFECTA', label: 'Trifecta', group: 'Exotic Bets' },
  { value: 'TRIFECTA_BOX', label: 'Trifecta Box', group: 'Exotic Bets' },
  { value: 'TRIFECTA_KEY', label: 'Trifecta Key', group: 'Exotic Bets' },
  // Superfecta
  { value: 'SUPERFECTA', label: 'Superfecta', group: 'Exotic Bets' },
  { value: 'SUPERFECTA_BOX', label: 'Superfecta Box', group: 'Exotic Bets' },
  // Other
  { value: 'QUINELLA', label: 'Quinella', group: 'Other' },
  // Multi-Race
  { value: 'DAILY_DOUBLE', label: 'Daily Double', group: 'Multi-Race' },
  { value: 'PICK_3', label: 'Pick 3', group: 'Multi-Race' },
  { value: 'PICK_4', label: 'Pick 4', group: 'Multi-Race' },
];

/**
 * Budget preset options
 */
export const BUDGET_PRESETS = [1, 2, 5, 10];

/**
 * Risk style configurations
 */
export const RISK_STYLE_CONFIG: Record<
  BuilderRiskStyle,
  { label: string; description: string; icon: string }
> = {
  safe: {
    label: 'Safe',
    description: 'Top-ranked horses, fewer combinations',
    icon: '🛡️',
  },
  balanced: {
    label: 'Balanced',
    description: 'Mix of favorites and value plays',
    icon: '⚖️',
  },
  aggressive: {
    label: 'Aggressive',
    description: 'Longshots with high edge',
    icon: '🔥',
  },
};
