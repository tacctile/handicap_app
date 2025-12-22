/**
 * Late-Breaking Information Analysis (Protocol 4)
 *
 * Handles special situations that can affect race dynamics:
 * - Scratch impact assessment
 * - Pace scenario recalculation after scratches
 * - Post position shift calculations
 * - Jockey change impact assessment
 * - Equipment change discovery
 *
 * NOTE: This module works with static DRF data.
 * Real-time features (live odds, weather updates, race-day scratches)
 * would require live data feeds (V2 feature).
 *
 * @module lateBreaking/lateBreakingAnalysis
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import { analyzePaceScenario, type PaceScenarioAnalysis } from '../scoring/paceAnalysis';

// ============================================================================
// TYPES
// ============================================================================

export interface ScratchImpact {
  /** Scratched horse info */
  scratchedHorse: {
    programNumber: number;
    horseName: string;
    runningStyle: string;
    postPosition: number;
    morningLineOdds: string;
  };
  /** Impact on pace scenario */
  paceImpact: {
    previousPPI: number;
    newPPI: number;
    change: 'softer' | 'harder' | 'neutral';
    description: string;
  };
  /** Impact on specific horses */
  beneficiaries: {
    programNumber: number;
    horseName: string;
    benefit: string;
    bonusPoints: number;
  }[];
  /** Impact on post positions */
  postImpact: {
    affectedPosts: number[];
    description: string;
  };
}

export interface JockeyChangeAnalysis {
  programNumber: number;
  horseName: string;
  /** Previous jockey if known (often "Rider TBA" or similar) */
  previousJockey: string | null;
  /** Current jockey */
  currentJockey: string;
  /** Impact assessment */
  impact: 'positive' | 'negative' | 'neutral' | 'unknown';
  /** Bonus/penalty points */
  points: number;
  /** Reasoning */
  reasoning: string;
}

export interface LateBreakingResult {
  /** Number of scratches detected */
  scratchCount: number;
  /** Detailed scratch impact analysis */
  scratchImpacts: ScratchImpact[];
  /** Jockey change analysis */
  jockeyChanges: JockeyChangeAnalysis[];
  /** Updated pace scenario (after scratches) */
  updatedPaceScenario: PaceScenarioAnalysis;
  /** Horses that benefit from late changes */
  beneficiaries: {
    programNumber: number;
    horseName: string;
    totalBonus: number;
    reasons: string[];
  }[];
  /** Summary for display */
  summary: string;
  /** Whether significant late-breaking info exists */
  hasSignificantChanges: boolean;
}

// ============================================================================
// SCRATCH IMPACT ANALYSIS
// ============================================================================

/**
 * Analyze the impact of a scratched horse on the race
 */
function analyzeScratchImpact(
  scratchedHorse: HorseEntry,
  activeHorses: HorseEntry[],
  originalPaceScenario: PaceScenarioAnalysis,
  newPaceScenario: PaceScenarioAnalysis
): ScratchImpact {
  const beneficiaries: ScratchImpact['beneficiaries'] = [];

  // Determine running style of scratched horse
  const scratchedStyle = scratchedHorse.runningStyle || 'U';

  // Calculate pace impact
  const ppiChange = newPaceScenario.ppi - originalPaceScenario.ppi;
  let paceChange: 'softer' | 'harder' | 'neutral' = 'neutral';
  let paceDescription = 'No significant pace change';

  if (ppiChange <= -10) {
    paceChange = 'softer';
    paceDescription = `Pace softens significantly (PPI: ${originalPaceScenario.ppi} → ${newPaceScenario.ppi})`;
  } else if (ppiChange >= 10) {
    paceChange = 'harder';
    paceDescription = `Pace heats up (PPI: ${originalPaceScenario.ppi} → ${newPaceScenario.ppi})`;
  } else if (ppiChange !== 0) {
    paceDescription = `Minor pace adjustment (PPI: ${originalPaceScenario.ppi} → ${newPaceScenario.ppi})`;
  }

  // Find beneficiaries
  for (const horse of activeHorses) {
    if (horse.isScratched) continue;

    const horseStyle = horse.runningStyle || 'U';
    let benefit = '';
    let bonusPoints = 0;

    // Speed scratch benefits closers
    if (scratchedStyle === 'E' && horseStyle === 'C') {
      benefit = 'Speed scratch softens pace';
      bonusPoints = 5;
    }
    // Closer scratch benefits speed
    else if (scratchedStyle === 'C' && horseStyle === 'E') {
      benefit = 'Closer scratch reduces late pressure';
      bonusPoints = 3;
    }
    // Post position benefit (inside scratch helps outside posts)
    else if (scratchedHorse.postPosition < horse.postPosition && horse.postPosition <= 5) {
      benefit = 'Inside scratch improves post dynamics';
      bonusPoints = 2;
    }

    if (benefit) {
      beneficiaries.push({
        programNumber: horse.programNumber,
        horseName: horse.horseName,
        benefit,
        bonusPoints,
      });
    }
  }

  // Post position impact
  const affectedPosts = activeHorses
    .filter((h) => !h.isScratched && h.postPosition > scratchedHorse.postPosition)
    .map((h) => h.postPosition);

  return {
    scratchedHorse: {
      programNumber: scratchedHorse.programNumber,
      horseName: scratchedHorse.horseName,
      runningStyle: scratchedStyle,
      postPosition: scratchedHorse.postPosition,
      morningLineOdds: scratchedHorse.morningLineOdds,
    },
    paceImpact: {
      previousPPI: originalPaceScenario.ppi,
      newPPI: newPaceScenario.ppi,
      change: paceChange,
      description: paceDescription,
    },
    beneficiaries,
    postImpact: {
      affectedPosts,
      description:
        affectedPosts.length > 0
          ? `Posts ${affectedPosts.join(', ')} effectively move inside`
          : 'No significant post position impact',
    },
  };
}

// ============================================================================
// JOCKEY CHANGE ANALYSIS
// ============================================================================

/**
 * Detect and analyze potential jockey changes
 *
 * Note: DRF files may show "Rider TBA" or similar for late jockey changes.
 * This function identifies those situations.
 */
function analyzeJockeyChanges(horses: HorseEntry[]): JockeyChangeAnalysis[] {
  const changes: JockeyChangeAnalysis[] = [];

  for (const horse of horses) {
    if (horse.isScratched) continue;

    const jockey = horse.jockeyName?.trim().toLowerCase() || '';

    // Detect TBA/unnamed jockey situations
    const isTBA =
      jockey === '' ||
      jockey === 'tba' ||
      jockey === 'rider tba' ||
      jockey.includes('unknown') ||
      jockey.includes('to be announced');

    if (isTBA) {
      changes.push({
        programNumber: horse.programNumber,
        horseName: horse.horseName,
        previousJockey: null,
        currentJockey: 'TBA',
        impact: 'unknown',
        points: 0,
        reasoning: 'Jockey not yet named - monitor for late rider change',
      });
      continue;
    }

    // Check for jockey switch from previous race
    const lastRace = horse.pastPerformances[0];
    if (lastRace && lastRace.jockey) {
      const prevJockey = lastRace.jockey.trim().toLowerCase();
      const currJockey = jockey;

      if (prevJockey !== currJockey && prevJockey !== '' && currJockey !== '') {
        // Jockey change detected - assess impact
        let impact: 'positive' | 'negative' | 'neutral' = 'neutral';
        let points = 0;
        let reasoning = `Jockey switch: ${lastRace.jockey} → ${horse.jockeyName}`;

        // Check if new jockey had previous wins with horse
        const jockeyWinHistory = horse.pastPerformances.filter(
          (pp) => pp.jockey?.toLowerCase() === currJockey && pp.finishPosition === 1
        );

        if (jockeyWinHistory.length > 0) {
          impact = 'positive';
          points = 5;
          reasoning += ` (rider reunited - ${jockeyWinHistory.length} previous wins together)`;
        }

        // Note: jockeyStats is a raw string in DRF format, detailed parsing would be needed for win %

        changes.push({
          programNumber: horse.programNumber,
          horseName: horse.horseName,
          previousJockey: lastRace.jockey,
          currentJockey: horse.jockeyName || 'Unknown',
          impact,
          points,
          reasoning,
        });
      }
    }
  }

  return changes;
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze late-breaking information for a race
 *
 * @param horses - All horses in the race (including scratched)
 * @param raceHeader - Race information
 * @returns Late-breaking analysis result
 */
export function analyzeLateBreakingInfo(
  horses: HorseEntry[],
  _raceHeader: RaceHeader
): LateBreakingResult {
  // Identify scratched and active horses
  const scratchedHorses = horses.filter((h) => h.isScratched);
  const activeHorses = horses.filter((h) => !h.isScratched);

  // Calculate pace scenarios (before and after scratches)
  // "Before" is approximated by including scratched horses
  const allHorsesForPace = horses.map((h) => ({ ...h, isScratched: false }));
  const originalPaceScenario = analyzePaceScenario(allHorsesForPace);
  const updatedPaceScenario = analyzePaceScenario(activeHorses);

  // Analyze each scratch's impact
  const scratchImpacts: ScratchImpact[] = [];
  for (const scratched of scratchedHorses) {
    const impact = analyzeScratchImpact(
      scratched,
      activeHorses,
      originalPaceScenario,
      updatedPaceScenario
    );
    scratchImpacts.push(impact);
  }

  // Analyze jockey changes
  const jockeyChanges = analyzeJockeyChanges(activeHorses);

  // Aggregate beneficiaries
  const beneficiaryMap = new Map<
    number,
    { horseName: string; totalBonus: number; reasons: string[] }
  >();

  // Add scratch beneficiaries
  for (const impact of scratchImpacts) {
    for (const ben of impact.beneficiaries) {
      const existing = beneficiaryMap.get(ben.programNumber);
      if (existing) {
        existing.totalBonus += ben.bonusPoints;
        existing.reasons.push(ben.benefit);
      } else {
        beneficiaryMap.set(ben.programNumber, {
          horseName: ben.horseName,
          totalBonus: ben.bonusPoints,
          reasons: [ben.benefit],
        });
      }
    }
  }

  // Add jockey change beneficiaries
  for (const jc of jockeyChanges) {
    if (jc.impact === 'positive' && jc.points > 0) {
      const existing = beneficiaryMap.get(jc.programNumber);
      if (existing) {
        existing.totalBonus += jc.points;
        existing.reasons.push(jc.reasoning);
      } else {
        beneficiaryMap.set(jc.programNumber, {
          horseName: jc.horseName,
          totalBonus: jc.points,
          reasons: [jc.reasoning],
        });
      }
    }
  }

  // Convert to array
  const beneficiaries = Array.from(beneficiaryMap.entries()).map(([programNumber, data]) => ({
    programNumber,
    ...data,
  }));

  // Determine significance
  const hasSignificantChanges =
    scratchedHorses.length > 0 ||
    jockeyChanges.some((jc) => jc.impact !== 'neutral') ||
    Math.abs(updatedPaceScenario.ppi - originalPaceScenario.ppi) >= 10;

  // Generate summary
  let summary = '';
  if (scratchedHorses.length > 0) {
    summary += `${scratchedHorses.length} scratch(es) detected. `;
  }
  if (Math.abs(updatedPaceScenario.ppi - originalPaceScenario.ppi) >= 10) {
    const direction = updatedPaceScenario.ppi < originalPaceScenario.ppi ? 'softened' : 'heated up';
    summary += `Pace has ${direction}. `;
  }
  if (jockeyChanges.length > 0) {
    const positiveChanges = jockeyChanges.filter((jc) => jc.impact === 'positive').length;
    if (positiveChanges > 0) {
      summary += `${positiveChanges} positive jockey change(s). `;
    }
  }
  if (beneficiaries.length > 0) {
    summary += `${beneficiaries.length} horse(s) benefit from late changes.`;
  }
  if (!summary) {
    summary = 'No significant late-breaking changes detected.';
  }

  return {
    scratchCount: scratchedHorses.length,
    scratchImpacts,
    jockeyChanges,
    updatedPaceScenario,
    beneficiaries,
    summary,
    hasSignificantChanges,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get late-breaking bonus points for a specific horse
 *
 * @param result - Late breaking analysis result
 * @param programNumber - Horse's program number
 * @returns Bonus points (0-15 max)
 */
export function getLateBreakingBonus(result: LateBreakingResult, programNumber: number): number {
  const beneficiary = result.beneficiaries.find((b) => b.programNumber === programNumber);
  // Cap at 15 points per Protocol 4 spec
  return Math.min(15, beneficiary?.totalBonus ?? 0);
}

/**
 * Get late-breaking reasons for a specific horse
 */
export function getLateBreakingReasons(
  result: LateBreakingResult,
  programNumber: number
): string[] {
  const beneficiary = result.beneficiaries.find((b) => b.programNumber === programNumber);
  return beneficiary?.reasons ?? [];
}

/**
 * Check if a horse benefits from scratches
 */
export function benefitsFromScratches(result: LateBreakingResult, programNumber: number): boolean {
  return result.scratchImpacts.some((impact) =>
    impact.beneficiaries.some((b) => b.programNumber === programNumber)
  );
}

/**
 * Get pace impact summary
 */
export function getPaceImpactSummary(result: LateBreakingResult): string {
  if (result.scratchCount === 0) {
    return 'No scratches - pace scenario unchanged';
  }

  const totalPaceChange = result.scratchImpacts.reduce((sum, impact) => {
    if (impact.paceImpact.change === 'softer') return sum - 1;
    if (impact.paceImpact.change === 'harder') return sum + 1;
    return sum;
  }, 0);

  if (totalPaceChange < 0) {
    return `Pace softened due to ${result.scratchCount} scratch(es)`;
  }
  if (totalPaceChange > 0) {
    return `Pace heated up due to ${result.scratchCount} scratch(es)`;
  }
  return `${result.scratchCount} scratch(es) - neutral pace impact`;
}

// Types are exported inline above
