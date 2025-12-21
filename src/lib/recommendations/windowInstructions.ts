/**
 * Window Instructions Module
 *
 * Generate exact betting window instructions for copy-paste or voice-to-window use.
 * Formats bets in the standard track betting window format.
 *
 * Examples:
 * - "$8 to win on the 3"
 * - "$3 exacta box, 3-5"
 * - "$2 exacta, 7 over 3, 5, 8"
 * - "$1 trifecta box, 3-5-7"
 * - "50 cent superfecta, 3 with 5,7 with 2,4,6 with ALL"
 *
 * @module recommendations/windowInstructions
 */

import type { ClassifiedHorse } from '../betting/tierClassification';
import type { BetRecommendation } from '../betting/betRecommendations';
import type { GeneratedBet } from './betGenerator';

// ============================================================================
// TYPES
// ============================================================================

export interface WindowInstruction {
  /** The formatted instruction text */
  text: string;
  /** Version without quotes for clipboard */
  plainText: string;
  /** Short version for mobile */
  shortText: string;
  /** Voice-friendly version */
  voiceText: string;
}

export interface BetSlipEntry {
  /** Bet type name */
  betType: string;
  /** Amount */
  amount: string;
  /** Horse numbers */
  horses: string;
  /** Full instruction */
  instruction: string;
  /** Potential return range */
  potentialReturn: string;
}

export interface FormattedBetSlip {
  /** Race information header */
  header: string;
  /** Individual bet entries */
  entries: BetSlipEntry[];
  /** Total cost */
  totalCost: string;
  /** Total potential return range */
  potentialReturnRange: string;
  /** Full formatted text for clipboard */
  fullText: string;
}

// ============================================================================
// AMOUNT FORMATTING
// ============================================================================

/**
 * Format bet amount for window instruction
 */
export function formatAmount(amount: number): string {
  if (amount < 1) {
    // Format cents (e.g., "50 cent", "10 cent")
    const cents = Math.round(amount * 100);
    return `${cents} cent`;
  }

  // Format dollars
  return `$${amount}`;
}

/**
 * Format amount for display
 */
export function formatDisplayAmount(amount: number): string {
  if (amount < 1) {
    return `$${amount.toFixed(2)}`;
  }
  return `$${Math.round(amount)}`;
}

/**
 * Format currency with proper decimals
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: amount < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ============================================================================
// HORSE NUMBER FORMATTING
// ============================================================================

/**
 * Format horse numbers for display (e.g., "3-5-7")
 */
export function formatHorseNumbers(horses: ClassifiedHorse[], separator = '-'): string {
  return horses.map((h) => h.horse.programNumber).join(separator);
}

/**
 * Format horse numbers with commas (e.g., "3, 5, 7")
 */
export function formatHorseNumbersComma(horses: ClassifiedHorse[]): string {
  return horses.map((h) => h.horse.programNumber).join(', ');
}

/**
 * Format horse numbers from array
 */
export function formatNumbers(numbers: number[], separator = '-'): string {
  return numbers.join(separator);
}

// ============================================================================
// WINDOW INSTRUCTION GENERATION
// ============================================================================

/**
 * Generate window instruction for a bet
 */
export function generateWindowInstruction(
  betType: string,
  horses: ClassifiedHorse[],
  amount: number,
  raceNumber?: number
): string {
  const racePrefix = raceNumber ? `Race ${raceNumber}, ` : '';
  const formattedAmount = formatAmount(amount);
  const numbers = formatHorseNumbers(horses);

  const firstHorse = horses[0];
  const firstHorseNum = firstHorse?.horse.programNumber ?? numbers;

  switch (betType) {
    case 'win':
      return `"${racePrefix}${formattedAmount} to WIN on number ${firstHorseNum}"`;

    case 'place':
      return `"${racePrefix}${formattedAmount} to PLACE on number ${firstHorseNum}"`;

    case 'show':
      return `"${racePrefix}${formattedAmount} to SHOW on number ${firstHorseNum}"`;

    case 'exacta_box':
      return `"${racePrefix}${formattedAmount} EXACTA BOX ${numbers}"`;

    case 'exacta_key_over':
      if (horses.length < 2 || !firstHorse)
        return `"${racePrefix}${formattedAmount} EXACTA ${numbers}"`;
      return `"${racePrefix}${formattedAmount} EXACTA, number ${firstHorse.horse.programNumber} on top with ${horses
        .slice(1)
        .map((h) => h.horse.programNumber)
        .join(', ')}"`;

    case 'exacta_key_under':
      if (horses.length < 2 || !firstHorse)
        return `"${racePrefix}${formattedAmount} EXACTA ${numbers}"`;
      return `"${racePrefix}${formattedAmount} EXACTA, ${horses
        .slice(1)
        .map((h) => h.horse.programNumber)
        .join(', ')} with number ${firstHorse.horse.programNumber} second"`;

    case 'trifecta_box':
      return `"${racePrefix}${formattedAmount} TRIFECTA BOX ${numbers}"`;

    case 'trifecta_key':
      if (horses.length < 3 || !firstHorse)
        return `"${racePrefix}${formattedAmount} TRIFECTA BOX ${numbers}"`;
      return `"${racePrefix}${formattedAmount} TRIFECTA, number ${firstHorse.horse.programNumber} first, with ${horses
        .slice(1)
        .map((h) => h.horse.programNumber)
        .join(', ')} for second and third"`;

    case 'trifecta_wheel':
      if (horses.length < 2 || !firstHorse)
        return `"${racePrefix}${formattedAmount} TRIFECTA ${numbers}"`;
      return `"${racePrefix}${formattedAmount} TRIFECTA WHEEL, number ${firstHorse.horse.programNumber} with ALL for second, ${horses
        .slice(1)
        .map((h) => h.horse.programNumber)
        .join(', ')} for third"`;

    case 'quinella':
      return `"${racePrefix}${formattedAmount} QUINELLA ${numbers}"`;

    case 'superfecta':
      return `"${racePrefix}${formattedAmount} SUPERFECTA BOX ${numbers}"`;

    case 'value_bomb':
    case 'hidden_gem':
      return `"${racePrefix}${formattedAmount} to WIN on number ${firstHorseNum}"`;

    default:
      return `"${racePrefix}${formattedAmount} on ${numbers}"`;
  }
}

/**
 * Generate full window instruction object with multiple formats
 */
export function generateFullInstruction(
  betType: string,
  horses: ClassifiedHorse[],
  amount: number,
  raceNumber?: number
): WindowInstruction {
  const instruction = generateWindowInstruction(betType, horses, amount, raceNumber);

  // Plain text without quotes
  const plainText = instruction.replace(/^"|"$/g, '');

  // Short version for mobile
  const shortText = generateShortInstruction(betType, horses, amount);

  // Voice-friendly version
  const voiceText = generateVoiceInstruction(betType, horses, amount, raceNumber);

  return {
    text: instruction,
    plainText,
    shortText,
    voiceText,
  };
}

/**
 * Generate short instruction for mobile
 */
function generateShortInstruction(
  betType: string,
  horses: ClassifiedHorse[],
  amount: number
): string {
  const amt = formatDisplayAmount(amount);
  const nums = horses.map((h) => h.horse.programNumber).join('-');
  const firstHorse = horses[0];
  const firstHorseNum = firstHorse?.horse.programNumber ?? '';

  switch (betType) {
    case 'win':
      return `${amt} W #${firstHorseNum}`;
    case 'place':
      return `${amt} P #${firstHorseNum}`;
    case 'show':
      return `${amt} S #${firstHorseNum}`;
    case 'exacta_box':
      return `${amt} EX Box ${nums}`;
    case 'exacta_key_over':
      return `${amt} EX #${firstHorseNum}/${nums}`;
    case 'exacta_key_under':
      return `${amt} EX ${nums}/#${firstHorseNum}`;
    case 'trifecta_box':
      return `${amt} TRI Box ${nums}`;
    case 'trifecta_key':
      return `${amt} TRI Key ${nums}`;
    case 'trifecta_wheel':
      return `${amt} TRI Wheel ${nums}`;
    case 'quinella':
      return `${amt} Q ${nums}`;
    case 'superfecta':
      return `${amt} Super ${nums}`;
    default:
      return `${amt} ${nums}`;
  }
}

/**
 * Generate voice-friendly instruction
 */
function generateVoiceInstruction(
  betType: string,
  horses: ClassifiedHorse[],
  amount: number,
  raceNumber?: number
): string {
  const racePrefix = raceNumber ? `Race ${raceNumber}. ` : '';
  const amountText = amount < 1 ? `${Math.round(amount * 100)} cents` : `${amount} dollars`;

  const horseNumbers = horses.map((h) => h.horse.programNumber).join(' and ');
  const firstHorse = horses[0];
  const firstHorseNum = firstHorse?.horse.programNumber ?? '';

  switch (betType) {
    case 'win':
      return `${racePrefix}${amountText} to win on number ${firstHorseNum}`;

    case 'place':
      return `${racePrefix}${amountText} to place on number ${firstHorseNum}`;

    case 'show':
      return `${racePrefix}${amountText} to show on number ${firstHorseNum}`;

    case 'exacta_box':
      return `${racePrefix}${amountText} exacta box, numbers ${horseNumbers}`;

    case 'exacta_key_over':
      return `${racePrefix}${amountText} exacta, number ${firstHorseNum} over ${horses
        .slice(1)
        .map((h) => h.horse.programNumber)
        .join(' and ')}`;

    case 'trifecta_box':
      return `${racePrefix}${amountText} trifecta box, numbers ${horseNumbers}`;

    case 'quinella':
      return `${racePrefix}${amountText} quinella, numbers ${horseNumbers}`;

    case 'superfecta':
      return `${racePrefix}${amountText} superfecta box, numbers ${horseNumbers}`;

    default:
      return `${racePrefix}${amountText} on numbers ${horseNumbers}`;
  }
}

// ============================================================================
// BET SLIP FORMATTING
// ============================================================================

/**
 * Format a complete bet slip for clipboard/print
 */
export function formatBetSlip(
  bets: (BetRecommendation | GeneratedBet)[],
  raceNumber: number,
  totalCost: number,
  potentialReturn: { min: number; max: number }
): FormattedBetSlip {
  const header = `Bet Slip - Race ${raceNumber}`;
  const divider = '='.repeat(40);

  const entries: BetSlipEntry[] = bets.map((bet) => ({
    betType: bet.typeName,
    amount: formatCurrency(bet.totalCost),
    horses: bet.horseNumbers.map((n) => `#${n}`).join(', '),
    instruction: bet.windowInstruction
      .replace(/^"/, `"Race ${raceNumber}, `)
      .replace(/Race \d+, Race \d+/, `Race ${raceNumber}`)
      .replace(/^"|"$/g, ''),
    potentialReturn: `${formatCurrency(bet.potentialReturn.min)} - ${formatCurrency(bet.potentialReturn.max)}`,
  }));

  const formattedEntries = entries
    .map(
      (e) => `${e.betType} (${e.amount}):\n  ${e.instruction}\n  Potential: ${e.potentialReturn}`
    )
    .join('\n\n');

  const fullText = [
    header,
    divider,
    formattedEntries,
    divider,
    `Total: ${formatCurrency(totalCost)}`,
    `Potential Return: ${formatCurrency(potentialReturn.min)} - ${formatCurrency(potentialReturn.max)}`,
  ].join('\n');

  return {
    header,
    entries,
    totalCost: formatCurrency(totalCost),
    potentialReturnRange: `${formatCurrency(potentialReturn.min)} - ${formatCurrency(potentialReturn.max)}`,
    fullText,
  };
}

/**
 * Format bet slip as simple list for quick copy
 */
export function formatBetSlipSimple(
  bets: (BetRecommendation | GeneratedBet)[],
  raceNumber: number
): string {
  return bets
    .map((bet) => {
      const instruction = bet.windowInstruction
        .replace(/^"/, `"Race ${raceNumber}, `)
        .replace(/Race \d+, Race \d+/, `Race ${raceNumber}`)
        .replace(/^"|"$/g, '');
      return `- ${instruction}`;
    })
    .join('\n');
}

/**
 * Format single bet for clipboard
 */
export function formatSingleBet(bet: BetRecommendation | GeneratedBet, raceNumber: number): string {
  return bet.windowInstruction
    .replace(/^"/, `"Race ${raceNumber}, `)
    .replace(/Race \d+, Race \d+/, `Race ${raceNumber}`)
    .replace(/^"|"$/g, '');
}

// ============================================================================
// SPECIAL BET FORMATS
// ============================================================================

/**
 * Generate part-wheel instruction (e.g., 1 with 2,3,4 with 5,6)
 */
export function generatePartWheelInstruction(
  amount: number,
  firstPosition: number[],
  secondPosition: number[],
  thirdPosition: number[],
  raceNumber?: number
): string {
  const racePrefix = raceNumber ? `Race ${raceNumber}, ` : '';
  const formattedAmount = formatAmount(amount);

  const first = firstPosition.join(',');
  const second = secondPosition.join(',');
  const third = thirdPosition.join(',');

  return `"${racePrefix}${formattedAmount} TRIFECTA PART WHEEL, ${first} with ${second} with ${third}"`;
}

/**
 * Generate superfecta instruction with ALL positions
 */
export function generateSuperfectaWithAllInstruction(
  amount: number,
  keyHorses: number[],
  allPosition: 1 | 2 | 3 | 4,
  raceNumber?: number
): string {
  const racePrefix = raceNumber ? `Race ${raceNumber}, ` : '';
  const formattedAmount = formatAmount(amount);

  const positions: string[] = ['', '', '', ''];
  let keyIndex = 0;

  for (let i = 0; i < 4; i++) {
    if (i === allPosition - 1) {
      positions[i] = 'ALL';
    } else if (keyIndex < keyHorses.length) {
      const keyHorse = keyHorses[keyIndex];
      if (keyHorse !== undefined) {
        positions[i] = keyHorse.toString();
      }
      keyIndex++;
    }
  }

  return `"${racePrefix}${formattedAmount} SUPERFECTA, ${positions.join(' with ')}"`;
}

/**
 * Generate daily double or pick instruction
 */
export function generateMultiRaceInstruction(
  betType: 'daily_double' | 'pick_3' | 'pick_4' | 'pick_5' | 'pick_6',
  amount: number,
  selectionsByRace: number[][],
  startingRace: number
): string {
  const betNames: Record<string, string> = {
    daily_double: 'DAILY DOUBLE',
    pick_3: 'PICK 3',
    pick_4: 'PICK 4',
    pick_5: 'PICK 5',
    pick_6: 'PICK 6',
  };

  const formattedAmount = formatAmount(amount);
  const raceLabel = betNames[betType];

  const selections = selectionsByRace.map((nums) => nums.join(',')).join(' / ');

  return `"Races ${startingRace}-${startingRace + selectionsByRace.length - 1}, ${formattedAmount} ${raceLabel}, ${selections}"`;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate instruction is properly formatted
 */
export function validateInstruction(instruction: string): boolean {
  // Must have quotes
  if (!instruction.startsWith('"') || !instruction.endsWith('"')) {
    return false;
  }

  // Must have an amount
  if (
    !instruction.match(
      /\$?\d+(?:\.\d{2})?\s*(?:cent|dollar|to|EXACTA|TRIFECTA|QUINELLA|SUPERFECTA)/i
    )
  ) {
    return false;
  }

  // Must have horse numbers
  if (!instruction.match(/\d+(?:[,-]\d+)*/)) {
    return false;
  }

  return true;
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { BetRecommendation, ClassifiedHorse };
