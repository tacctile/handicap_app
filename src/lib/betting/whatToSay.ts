/**
 * What to Say Script Generator
 *
 * Generates exact phrases to say at the betting window.
 * These are designed to be clear, unambiguous, and efficient.
 */

import type { BetType } from './betTypes';

// ============================================================================
// SCRIPT GENERATION
// ============================================================================

/**
 * Generate the exact phrase to say at the betting window
 */
export function generateWhatToSay(
  betType: BetType,
  horses: number[],
  amount: number,
  raceNumber?: number
): string {
  const racePrefix = raceNumber ? `Race ${raceNumber}, ` : '';

  switch (betType) {
    case 'WIN':
      return `${racePrefix}$${amount} to WIN on number ${horses[0]}`;

    case 'PLACE':
      return `${racePrefix}$${amount} to PLACE on number ${horses[0]}`;

    case 'SHOW':
      return `${racePrefix}$${amount} to SHOW on number ${horses[0]}`;

    case 'EXACTA':
      return `${racePrefix}$${amount} EXACTA, ${horses[0]} over ${horses[1]}`;

    case 'EXACTA_BOX':
      return `${racePrefix}$${amount} EXACTA BOX, ${formatHorseList(horses)}`;

    case 'TRIFECTA_KEY': {
      // Format: "$2 TRIFECTA KEY, number 2 ALL with 3, 1, and 5"
      const keyHorse = horses[0];
      const withHorses = horses.slice(1);
      return `${racePrefix}$${amount} TRIFECTA KEY, number ${keyHorse} ALL with ${formatHorseList(withHorses)}`;
    }

    case 'TRIFECTA_BOX':
      return `${racePrefix}$${amount} TRIFECTA BOX, ${formatHorseList(horses)}`;

    case 'SUPERFECTA_KEY': {
      const superKey = horses[0];
      const superWith = horses.slice(1);
      return `${racePrefix}$${amount} SUPERFECTA KEY, number ${superKey} ALL with ${formatHorseList(superWith)}`;
    }

    case 'SUPERFECTA_BOX':
      return `${racePrefix}$${amount} SUPERFECTA BOX, ${formatHorseList(horses)}`;

    case 'QUINELLA':
      return `${racePrefix}$${amount} QUINELLA, ${horses[0]} and ${horses[1]}`;

    case 'TRIFECTA':
      return `${racePrefix}$${amount} TRIFECTA, ${horses[0]}-${horses[1]}-${horses[2]}`;

    default:
      return `$${amount} ${betType} on ${horses.join(', ')}`;
  }
}

/**
 * Format a list of horses for speaking
 * [2, 3, 5] -> "2, 3, and 5"
 * [2, 3] -> "2 and 3"
 */
function formatHorseList(horses: number[]): string {
  if (horses.length === 0) return '';
  if (horses.length === 1) return String(horses[0]);
  if (horses.length === 2) return `${horses[0]} and ${horses[1]}`;

  const allButLast = horses.slice(0, -1).join(', ');
  const last = horses[horses.length - 1];
  return `${allButLast}, and ${last}`;
}

/**
 * Generate a complete ticket description for copying
 * Includes all bets for a race
 */
export function generateCompleteTicket(
  raceNumber: number,
  trackName: string,
  bets: Array<{ betType: BetType; horses: number[]; amount: number; totalCost: number }>
): string {
  const lines: string[] = [`${trackName} - Race ${raceNumber}`, '---'];

  for (const bet of bets) {
    const whatToSay = generateWhatToSay(bet.betType, bet.horses, bet.amount);
    lines.push(`${whatToSay}`);
    lines.push(`  Cost: $${bet.totalCost}`);
  }

  const totalCost = bets.reduce((sum, b) => sum + b.totalCost, 0);
  lines.push('---');
  lines.push(`Total: $${totalCost}`);

  return lines.join('\n');
}

/**
 * Generate a shareable summary of bets
 */
export function generateShareableSummary(
  raceNumber: number,
  trackName: string,
  bets: Array<{
    betType: BetType;
    horses: number[];
    horseNames: string[];
    amount: number;
    totalCost: number;
    potentialReturn: { min: number; max: number };
  }>,
  valuePlay?: {
    horseName: string;
    programNumber: number;
    currentOdds: string;
    valueEdge: number;
  } | null
): string {
  const lines: string[] = [`🏇 ${trackName} Race ${raceNumber}`, ''];

  if (valuePlay) {
    lines.push(`🎯 VALUE PLAY: #${valuePlay.programNumber} ${valuePlay.horseName}`);
    lines.push(`   Odds: ${valuePlay.currentOdds} | Edge: +${Math.round(valuePlay.valueEdge)}%`);
    lines.push('');
  }

  lines.push('BETS:');
  for (const bet of bets) {
    const horseStr =
      bet.horseNames.length > 1
        ? `#${bet.horses.join(', #')}`
        : `#${bet.horses[0]} ${bet.horseNames[0]}`;
    lines.push(`• $${bet.totalCost} ${bet.betType.replace('_', ' ')} - ${horseStr}`);
    lines.push(`  Potential: $${bet.potentialReturn.min}-${bet.potentialReturn.max}`);
  }

  const totalCost = bets.reduce((sum, b) => sum + b.totalCost, 0);
  lines.push('');
  lines.push(`Total wagered: $${totalCost}`);

  return lines.join('\n');
}

// ============================================================================
// EXPLANATION GENERATION
// ============================================================================

/**
 * Generate why we're making this specific bet
 */
export function generateBetExplanation(
  betType: BetType,
  horseNames: string[],
  primaryOdds: number,
  valueEdge: number,
  modelRank: number,
  isValuePlay: boolean
): string {
  const horseName = horseNames[0] || 'This horse';

  if (isValuePlay) {
    switch (betType) {
      case 'PLACE':
        return `${horseName} is ranked #${modelRank} by our model — a strong contender for the top 3. But the public has him at ${Math.round(primaryOdds)}-1, treating him like a longshot. That's a +${Math.round(valueEdge)}% edge. PLACE means he just needs to finish 1st or 2nd to cash. At these odds, even 2nd place pays great.`;

      case 'SHOW':
        return `${horseName} is ranked #${modelRank} — our model thinks he'll hit the board (top 3). The ${Math.round(primaryOdds)}-1 odds give us +${Math.round(valueEdge)}% edge. SHOW is the safest play here: 1st, 2nd, or 3rd all cash.`;

      case 'WIN':
        return `${horseName} is our #${modelRank} pick with +${Math.round(valueEdge)}% edge at ${Math.round(primaryOdds)}-1. The model strongly favors this horse, and the public hasn't caught on yet. WIN bet for maximum payout if he takes it.`;

      case 'TRIFECTA_KEY':
        return `If ${horseName} finishes anywhere in the top 3, combined with our other contenders, you cash. At ${Math.round(primaryOdds)}-1 odds, having him in a trifecta pays huge. This is our "swing for the fences" bet.`;

      case 'EXACTA':
        return `${horseName} at ${Math.round(primaryOdds)}-1 paired with our top pick. If they run 1-2, this exacta pays well above what the crowd expects.`;

      default:
        return `${horseName} has +${Math.round(valueEdge)}% edge at ${Math.round(primaryOdds)}-1 odds.`;
    }
  } else {
    // Non-value play explanation (defensive bets)
    switch (betType) {
      case 'SHOW':
        return `${horseName} is our top-ranked horse. Even without big value, SHOW is a safe way to cash a ticket if the favorite holds form.`;

      case 'TRIFECTA_BOX':
        return `Boxing our top contenders gives us a shot at the trifecta if the favorites hold form. It's a defensive play — we're betting on form to hold.`;

      default:
        return `${horseName} is a contender worth including for coverage.`;
    }
  }
}

/**
 * Generate why we're SKIPPING a horse
 */
export function generateSkipExplanation(
  horseName: string,
  odds: number,
  _modelRank: number,
  edge: number
): string {
  if (edge < 0) {
    return `Yes, ${horseName} is our top-ranked horse. He's the most likely winner. But at ${Math.round(odds)}-1 odds, you're not getting paid enough. Our model says fair odds are higher. At ${Math.round(odds)}-1, you're giving away value. Long-term, betting horses like this loses money. Use him in exactas or trifectas WITH your value play, but don't bet him to win outright.`;
  }

  if (odds < 6) {
    return `${horseName} is chalky at ${Math.round(odds)}-1. Even if he's a contender, the risk/reward isn't there for straight bets. Consider using him underneath in exotics.`;
  }

  return `${horseName} doesn't meet our value thresholds for this race.`;
}
