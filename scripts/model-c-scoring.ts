/**
 * Model C Scoring System
 *
 * A simplified 5-factor scoring model to test the hypothesis that
 * complex algorithms with 25+ factors suffer from feature bloat and echoes.
 *
 * TOTAL MAX SCORE: 125 points
 *
 * Factors:
 * 1. SPEED (50 pts max, 40%) - Best Beyer from last 3 races vs class par
 * 2. CLASS (25 pts max, 20%) - Class movement analysis
 * 3. FORM/FITNESS (20 pts max, 16%) - Days since last race
 * 4. PACE (20 pts max, 16%) - Running style fit to race shape
 * 5. CONNECTIONS (10 pts max, 8%) - Trainer + Jockey win rates
 *
 * NO overlays. NO caps. NO penalties. NO multipliers.
 */

import type { HorseEntry, RaceHeader, PastPerformance, RaceClassification } from '../src/types/drf';

// ============================================================================
// TYPES
// ============================================================================

export interface ModelCScore {
  total: number;
  speed: { score: number; reasoning: string };
  class: { score: number; reasoning: string };
  form: { score: number; reasoning: string };
  pace: { score: number; reasoning: string };
  connections: { score: number; reasoning: string };
}

export interface ModelCScoredHorse {
  horse: HorseEntry;
  index: number;
  score: ModelCScore;
  rank: number;
  isScratched: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Class par figures (same as Model B for consistency)
const CLASS_PAR_FIGURES: Record<RaceClassification, number> = {
  'maiden-claiming': 65,
  'maiden': 72,
  'claiming': 75,
  'starter-allowance': 78,
  'allowance': 82,
  'allowance-optional-claiming': 85,
  'handicap': 88,
  'stakes': 90,
  'stakes-listed': 93,
  'stakes-graded-3': 96,
  'stakes-graded-2': 100,
  'stakes-graded-1': 105,
  'unknown': 75,
};

// Class level hierarchy
const CLASS_HIERARCHY: Record<RaceClassification, number> = {
  'maiden-claiming': 1,
  'maiden': 2,
  'claiming': 3,
  'starter-allowance': 4,
  'allowance': 5,
  'allowance-optional-claiming': 6,
  'handicap': 7,
  'stakes': 8,
  'stakes-listed': 9,
  'stakes-graded-3': 10,
  'stakes-graded-2': 11,
  'stakes-graded-1': 12,
  'unknown': 3,
};

// ============================================================================
// FACTOR 1: SPEED (50 points max)
// ============================================================================

/**
 * Get best Beyer speed figure from last 3 races
 */
function getBestBeyerLast3(horse: HorseEntry): number | null {
  const recentPPs = horse.pastPerformances.slice(0, 3);

  let bestBeyer: number | null = null;
  for (const pp of recentPPs) {
    const beyer = pp.speedFigures.beyer;
    if (beyer !== null && beyer > 0) {
      if (bestBeyer === null || beyer > bestBeyer) {
        bestBeyer = beyer;
      }
    }
  }

  // Fallback to horse's stored best beyer if no PPs
  if (bestBeyer === null && horse.bestBeyer !== null && horse.bestBeyer > 0) {
    bestBeyer = horse.bestBeyer;
  }

  return bestBeyer;
}

/**
 * Calculate SPEED score (0-50 points)
 *
 * Scoring based on differential to class par:
 * +10 or more above par → 50 pts
 * +7 to +9 → 45 pts
 * +4 to +6 → 40 pts
 * +1 to +3 → 35 pts
 * At par (0) → 30 pts
 * -1 to -3 → 25 pts
 * -4 to -6 → 20 pts
 * -7 to -9 → 15 pts
 * -10 or worse → 10 pts
 * No Beyer → 10 pts (unknown, lowest tier)
 */
export function calculateSpeedScore(horse: HorseEntry, raceHeader: RaceHeader): { score: number; reasoning: string } {
  const parForClass = CLASS_PAR_FIGURES[raceHeader.classification];
  const bestBeyer = getBestBeyerLast3(horse);

  if (bestBeyer === null) {
    return {
      score: 10,
      reasoning: 'No Beyer figures available (unknown speed)',
    };
  }

  const differential = bestBeyer - parForClass;

  let score: number;
  let tier: string;

  if (differential >= 10) {
    score = 50;
    tier = 'Elite';
  } else if (differential >= 7) {
    score = 45;
    tier = 'Strong';
  } else if (differential >= 4) {
    score = 40;
    tier = 'Good';
  } else if (differential >= 1) {
    score = 35;
    tier = 'Above par';
  } else if (differential === 0) {
    score = 30;
    tier = 'At par';
  } else if (differential >= -3) {
    score = 25;
    tier = 'Slightly below';
  } else if (differential >= -6) {
    score = 20;
    tier = 'Below par';
  } else if (differential >= -9) {
    score = 15;
    tier = 'Well below';
  } else {
    score = 10;
    tier = 'Outclassed';
  }

  const diffStr = differential >= 0 ? `+${differential}` : `${differential}`;
  return {
    score,
    reasoning: `${bestBeyer} Beyer (${diffStr} vs par ${parForClass}) - ${tier}`,
  };
}

// ============================================================================
// FACTOR 2: CLASS (25 points max)
// ============================================================================

/**
 * Calculate CLASS score (0-25 points)
 *
 * Dropping in class → 25 pts
 * Same class → 20 pts
 * Slight raise (1 level) → 15 pts
 * Significant raise (2+ levels) → 10 pts
 * First-time starter → 15 pts (neutral)
 */
export function calculateClassScore(horse: HorseEntry, raceHeader: RaceHeader): { score: number; reasoning: string } {
  const currentClass = raceHeader.classification;
  const currentLevel = CLASS_HIERARCHY[currentClass];

  // First time starter
  if (horse.pastPerformances.length === 0) {
    return {
      score: 15,
      reasoning: 'First-time starter (class unknown)',
    };
  }

  const lastPP = horse.pastPerformances[0];
  if (!lastPP) {
    return {
      score: 15,
      reasoning: 'No past performance data',
    };
  }

  const lastClass = lastPP.classification;
  const lastLevel = CLASS_HIERARCHY[lastClass];
  const levelDiff = currentLevel - lastLevel;

  // Also check claiming price if available
  let priceChange = '';
  if (raceHeader.claimingPrice && lastPP.claimingPrice) {
    const priceDiff = raceHeader.claimingPrice - lastPP.claimingPrice;
    if (priceDiff < 0) {
      priceChange = ` (dropping $${Math.abs(priceDiff).toLocaleString()})`;
    } else if (priceDiff > 0) {
      priceChange = ` (raising $${priceDiff.toLocaleString()})`;
    }
  }

  if (levelDiff < 0) {
    // Dropping in class
    return {
      score: 25,
      reasoning: `Dropping ${Math.abs(levelDiff)} level(s) in class${priceChange}`,
    };
  } else if (levelDiff === 0) {
    // Same class
    return {
      score: 20,
      reasoning: `Same class level${priceChange}`,
    };
  } else if (levelDiff === 1) {
    // Slight raise
    return {
      score: 15,
      reasoning: `Slight class raise (1 level)${priceChange}`,
    };
  } else {
    // Significant raise
    return {
      score: 10,
      reasoning: `Significant class raise (${levelDiff} levels)${priceChange}`,
    };
  }
}

// ============================================================================
// FACTOR 3: FORM/FITNESS (20 points max)
// ============================================================================

/**
 * Calculate FORM/FITNESS score (0-20 points)
 *
 * Based on days since last race:
 * 14-35 days → 20 pts (optimal freshness)
 * 7-13 days → 15 pts (quick turnback)
 * 36-60 days → 15 pts (freshening)
 * 61-90 days → 10 pts (layoff)
 * 91+ days → 5 pts (extended layoff)
 * First time starter → 10 pts (unknown)
 */
export function calculateFormScore(horse: HorseEntry): { score: number; reasoning: string } {
  // First time starter
  if (horse.pastPerformances.length === 0) {
    return {
      score: 10,
      reasoning: 'First-time starter (form unknown)',
    };
  }

  const days = horse.daysSinceLastRace;

  if (days === null || days === undefined) {
    return {
      score: 10,
      reasoning: 'Days since last race unknown',
    };
  }

  if (days >= 14 && days <= 35) {
    return {
      score: 20,
      reasoning: `${days} days since last race (optimal freshness)`,
    };
  } else if (days >= 7 && days <= 13) {
    return {
      score: 15,
      reasoning: `${days} days since last race (quick turnback)`,
    };
  } else if (days >= 36 && days <= 60) {
    return {
      score: 15,
      reasoning: `${days} days since last race (freshening)`,
    };
  } else if (days >= 61 && days <= 90) {
    return {
      score: 10,
      reasoning: `${days} days since last race (layoff)`,
    };
  } else if (days > 90) {
    return {
      score: 5,
      reasoning: `${days} days since last race (extended layoff)`,
    };
  } else {
    // Less than 7 days - very quick turnback
    return {
      score: 10,
      reasoning: `${days} days since last race (very quick turnback)`,
    };
  }
}

// ============================================================================
// FACTOR 4: PACE (20 points max)
// ============================================================================

type RunningStyle = 'E' | 'EP' | 'P' | 'S' | 'C' | 'U';

/**
 * Parse running style from horse data
 */
function parseRunningStyle(horse: HorseEntry): RunningStyle {
  // Check explicit running style first
  const style = horse.runningStyle?.toUpperCase();
  if (style === 'E' || style === 'EP' || style === 'P' || style === 'S' || style === 'C') {
    return style as RunningStyle;
  }

  // Infer from early speed rating if available
  const esr = horse.earlySpeedRating;
  if (esr !== null) {
    if (esr >= 90) return 'E';
    if (esr >= 75) return 'EP';
    if (esr >= 60) return 'P';
    if (esr >= 40) return 'S';
    return 'C';
  }

  // Try to infer from past performances
  const recentPPs = horse.pastPerformances.slice(0, 3);
  if (recentPPs.length > 0) {
    // Look at first call positions
    let avgFirstCall = 0;
    let count = 0;
    for (const pp of recentPPs) {
      if (pp.firstCallPosition !== null && pp.firstCallPosition > 0) {
        avgFirstCall += pp.firstCallPosition;
        count++;
      }
    }
    if (count > 0) {
      avgFirstCall = avgFirstCall / count;
      if (avgFirstCall <= 2) return 'E';
      if (avgFirstCall <= 3.5) return 'EP';
      if (avgFirstCall <= 5) return 'P';
      if (avgFirstCall <= 7) return 'S';
      return 'C';
    }
  }

  return 'U';
}

/**
 * Analyze field pace dynamics
 */
function analyzeFieldPace(horses: HorseEntry[]): {
  speedCount: number;
  presserCount: number;
  closerCount: number;
  expectedPace: 'hot' | 'honest' | 'soft';
} {
  let speedCount = 0;
  let presserCount = 0;
  let closerCount = 0;

  for (const horse of horses) {
    const style = parseRunningStyle(horse);
    switch (style) {
      case 'E':
        speedCount++;
        break;
      case 'EP':
      case 'P':
        presserCount++;
        break;
      case 'S':
      case 'C':
        closerCount++;
        break;
    }
  }

  // Determine expected pace
  let expectedPace: 'hot' | 'honest' | 'soft';
  if (speedCount >= 3) {
    expectedPace = 'hot';
  } else if (speedCount >= 2) {
    expectedPace = 'honest';
  } else {
    expectedPace = 'soft';
  }

  return { speedCount, presserCount, closerCount, expectedPace };
}

/**
 * Calculate PACE score (0-20 points)
 *
 * Running style fit to likely race shape:
 * Lone speed (only E in field with soft pace) → 20 pts
 * Favorable setup (style matches pace scenario) → 15 pts
 * Neutral → 10 pts
 * Unfavorable (speed in speed duel, closer in slow pace) → 5 pts
 */
export function calculatePaceScore(horse: HorseEntry, activeHorses: HorseEntry[]): { score: number; reasoning: string } {
  const style = parseRunningStyle(horse);
  const fieldAnalysis = analyzeFieldPace(activeHorses);

  if (style === 'U') {
    return {
      score: 10,
      reasoning: 'Running style unknown (neutral)',
    };
  }

  const styleName: Record<RunningStyle, string> = {
    'E': 'Early Speed',
    'EP': 'Early Presser',
    'P': 'Presser',
    'S': 'Stalker',
    'C': 'Closer',
    'U': 'Unknown',
  };

  // Early speed in soft pace = perfect (lone speed)
  if (style === 'E' && fieldAnalysis.expectedPace === 'soft') {
    if (fieldAnalysis.speedCount === 1) {
      return {
        score: 20,
        reasoning: `Lone speed in soft pace (${styleName[style]}) - Perfect setup`,
      };
    }
    return {
      score: 15,
      reasoning: `Speed in soft pace (${styleName[style]}) - Favorable`,
    };
  }

  // Early speed in hot pace = unfavorable
  if (style === 'E' && fieldAnalysis.expectedPace === 'hot') {
    return {
      score: 5,
      reasoning: `Speed in hot pace with ${fieldAnalysis.speedCount} speed horses - Unfavorable`,
    };
  }

  // Closer in hot pace = favorable
  if ((style === 'C' || style === 'S') && fieldAnalysis.expectedPace === 'hot') {
    return {
      score: 15,
      reasoning: `${styleName[style]} in hot pace - Favorable setup`,
    };
  }

  // Closer in soft pace = unfavorable
  if ((style === 'C' || style === 'S') && fieldAnalysis.expectedPace === 'soft') {
    return {
      score: 5,
      reasoning: `${styleName[style]} in soft pace - Unfavorable, need pace`,
    };
  }

  // Pressers are versatile
  if (style === 'EP' || style === 'P') {
    if (fieldAnalysis.expectedPace === 'honest') {
      return {
        score: 15,
        reasoning: `${styleName[style]} in honest pace - Favorable`,
      };
    }
    return {
      score: 12,
      reasoning: `${styleName[style]} - Versatile style`,
    };
  }

  // Default neutral
  return {
    score: 10,
    reasoning: `${styleName[style]} in ${fieldAnalysis.expectedPace} pace - Neutral`,
  };
}

// ============================================================================
// FACTOR 5: CONNECTIONS (10 points max)
// ============================================================================

/**
 * Calculate CONNECTIONS score (0-10 points)
 *
 * Trainer meet win%:
 *   >= 20% → 5 pts
 *   >= 15% → 4 pts
 *   >= 10% → 3 pts
 *   else → 2 pts
 *
 * Jockey meet win%:
 *   >= 20% → 5 pts
 *   >= 15% → 4 pts
 *   >= 10% → 3 pts
 *   else → 2 pts
 *
 * That's it. No partnership bonus. No patterns. No specialties.
 */
export function calculateConnectionsScore(horse: HorseEntry): { score: number; reasoning: string } {
  let trainerScore = 2; // Default
  let jockeyScore = 2; // Default

  // Trainer win rate
  const trainerWinPct = horse.trainerStats?.currentMeetWinPct ??
                        horse.trainerStats?.currentYearWinPct ??
                        0;

  if (trainerWinPct >= 20) {
    trainerScore = 5;
  } else if (trainerWinPct >= 15) {
    trainerScore = 4;
  } else if (trainerWinPct >= 10) {
    trainerScore = 3;
  }

  // Jockey win rate
  const jockeyWinPct = horse.jockeyStats?.currentMeetWinPct ??
                       horse.jockeyStats?.currentYearWinPct ??
                       0;

  if (jockeyWinPct >= 20) {
    jockeyScore = 5;
  } else if (jockeyWinPct >= 15) {
    jockeyScore = 4;
  } else if (jockeyWinPct >= 10) {
    jockeyScore = 3;
  }

  const total = trainerScore + jockeyScore;

  const trainerName = horse.trainerName || 'Unknown';
  const jockeyName = horse.jockeyName || 'Unknown';

  return {
    score: total,
    reasoning: `Trainer ${trainerName} (${trainerWinPct.toFixed(1)}%→${trainerScore}pts) + Jockey ${jockeyName} (${jockeyWinPct.toFixed(1)}%→${jockeyScore}pts)`,
  };
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate Model C score for a single horse
 *
 * NO overlays. NO caps. NO penalties. NO multipliers.
 * Just 5 clean factors adding up to a max of 125 points.
 */
export function calculateModelCScore(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  activeHorses: HorseEntry[],
  isScratched: boolean
): ModelCScore {
  if (isScratched) {
    return {
      total: 0,
      speed: { score: 0, reasoning: 'Scratched' },
      class: { score: 0, reasoning: 'Scratched' },
      form: { score: 0, reasoning: 'Scratched' },
      pace: { score: 0, reasoning: 'Scratched' },
      connections: { score: 0, reasoning: 'Scratched' },
    };
  }

  const speed = calculateSpeedScore(horse, raceHeader);
  const classScore = calculateClassScore(horse, raceHeader);
  const form = calculateFormScore(horse);
  const pace = calculatePaceScore(horse, activeHorses);
  const connections = calculateConnectionsScore(horse);

  const total = speed.score + classScore.score + form.score + pace.score + connections.score;

  return {
    total,
    speed,
    class: classScore,
    form,
    pace,
    connections,
  };
}

/**
 * Calculate Model C scores for all horses in a race
 * Returns horses sorted by post position with rank assigned
 */
export function calculateModelCRaceScores(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  isScratched: (index: number) => boolean
): ModelCScoredHorse[] {
  // Get active horses for pace analysis
  const activeHorses = horses.filter((_, i) => !isScratched(i));

  // Score all horses
  const scoredHorses: ModelCScoredHorse[] = horses.map((horse, index) => ({
    horse,
    index,
    score: calculateModelCScore(horse, raceHeader, activeHorses, isScratched(index)),
    rank: 0,
    isScratched: isScratched(index),
  }));

  // Sort active horses by score to assign ranks
  const activeScored = scoredHorses
    .filter(h => !h.isScratched)
    .sort((a, b) => b.score.total - a.score.total);

  // Assign ranks (1-based)
  activeScored.forEach((h, i) => {
    h.rank = i + 1;
  });

  // Scratched horses get rank 99
  scoredHorses.forEach(h => {
    if (h.isScratched) {
      h.rank = 99;
    }
  });

  return scoredHorses;
}
