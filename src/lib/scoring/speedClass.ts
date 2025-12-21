/**
 * Speed & Class Scoring Module
 * Calculates scores based on speed figures and class level analysis
 *
 * Score Breakdown:
 * - Speed Figure Score: 0-30 points (based on Beyer/TimeformUS figures)
 * - Class Level Score: 0-20 points (based on class movement and success)
 *
 * Total: 0-50 points
 */

import type { HorseEntry, RaceHeader, PastPerformance, RaceClassification } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

export interface SpeedClassScoreResult {
  total: number;
  speedScore: number;
  classScore: number;
  bestRecentFigure: number | null;
  averageFigure: number | null;
  parForClass: number;
  classMovement: 'drop' | 'rise' | 'level' | 'unknown';
  speedReasoning: string;
  classReasoning: string;
}

// ============================================================================
// CLASS LEVEL HIERARCHY
// ============================================================================

// Class levels ranked from lowest to highest
const CLASS_HIERARCHY: Record<RaceClassification, number> = {
  'maiden-claiming': 1,
  maiden: 2,
  claiming: 3,
  'starter-allowance': 4,
  allowance: 5,
  'allowance-optional-claiming': 6,
  handicap: 7,
  stakes: 8,
  'stakes-listed': 9,
  'stakes-graded-3': 10,
  'stakes-graded-2': 11,
  'stakes-graded-1': 12,
  unknown: 3, // Default to claiming level
};

// Par speed figures by class level (approximate Beyer figures)
const CLASS_PAR_FIGURES: Record<RaceClassification, number> = {
  'maiden-claiming': 65,
  maiden: 72,
  claiming: 75,
  'starter-allowance': 78,
  allowance: 82,
  'allowance-optional-claiming': 85,
  handicap: 88,
  stakes: 90,
  'stakes-listed': 93,
  'stakes-graded-3': 96,
  'stakes-graded-2': 100,
  'stakes-graded-1': 105,
  unknown: 75,
};

// ============================================================================
// SPEED FIGURE EXTRACTION
// ============================================================================

/**
 * Extract the best available speed figure from a past performance
 * Prefers Beyer, falls back to TimeformUS, then Equibase
 */
function extractSpeedFigure(pp: PastPerformance): number | null {
  const figures = pp.speedFigures;

  // Prefer Beyer as primary
  if (figures.beyer !== null && figures.beyer > 0) {
    return figures.beyer;
  }

  // TimeformUS as secondary
  if (figures.timeformUS !== null && figures.timeformUS > 0) {
    return figures.timeformUS;
  }

  // Equibase as fallback
  if (figures.equibase !== null && figures.equibase > 0) {
    return figures.equibase;
  }

  return null;
}

/**
 * Get best speed figure from last N races
 */
function getBestRecentFigure(
  pastPerformances: PastPerformance[],
  count: number = 3
): number | null {
  const recentPPs = pastPerformances.slice(0, count);

  const figures = recentPPs.map(extractSpeedFigure).filter((f): f is number => f !== null);

  if (figures.length === 0) return null;

  return Math.max(...figures);
}

/**
 * Get average speed figure from last N races
 */
function getAverageFigure(pastPerformances: PastPerformance[], count: number = 5): number | null {
  const recentPPs = pastPerformances.slice(0, count);

  const figures = recentPPs.map(extractSpeedFigure).filter((f): f is number => f !== null);

  if (figures.length === 0) return null;

  return Math.round(figures.reduce((a, b) => a + b, 0) / figures.length);
}

/**
 * Get last Beyer from horse entry
 */
function getLastBeyerFromEntry(horse: HorseEntry): number | null {
  if (horse.lastBeyer !== null && horse.lastBeyer > 0) {
    return horse.lastBeyer;
  }

  if (horse.pastPerformances.length > 0) {
    return extractSpeedFigure(horse.pastPerformances[0]);
  }

  return null;
}

// ============================================================================
// SPEED FIGURE SCORING
// ============================================================================

/**
 * Calculate speed figure score (0-30 points)
 * Based on comparison to par for today's class
 */
function calculateSpeedFigureScore(
  bestRecent: number | null,
  average: number | null,
  parForClass: number
): { score: number; reasoning: string } {
  // Use best recent figure primarily, average as fallback
  const figure = bestRecent ?? average;

  if (figure === null) {
    return {
      score: 15, // Neutral score for no data
      reasoning: 'No speed figures available',
    };
  }

  const differential = figure - parForClass;

  let score: number;
  let reasoning: string;

  if (differential >= 10) {
    score = 30;
    reasoning = `${figure} Beyer (${differential}+ above par ${parForClass})`;
  } else if (differential >= 5) {
    score = 25;
    reasoning = `${figure} Beyer (${differential} above par ${parForClass})`;
  } else if (differential >= 0) {
    score = 20;
    reasoning = `${figure} Beyer (at par ${parForClass})`;
  } else if (differential >= -5) {
    score = 15;
    reasoning = `${figure} Beyer (${Math.abs(differential)} below par ${parForClass})`;
  } else if (differential >= -10) {
    score = 10;
    reasoning = `${figure} Beyer (${Math.abs(differential)} below par ${parForClass})`;
  } else {
    score = 5;
    reasoning = `${figure} Beyer (significantly below par ${parForClass})`;
  }

  if (bestRecent !== null && average !== null) {
    reasoning += ` | Best: ${bestRecent}, Avg: ${average}`;
  }

  return { score, reasoning };
}

// ============================================================================
// CLASS LEVEL ANALYSIS
// ============================================================================

/**
 * Determine class movement from past performances
 */
function analyzeClassMovement(
  currentClass: RaceClassification,
  pastPerformances: PastPerformance[]
): 'drop' | 'rise' | 'level' | 'unknown' {
  if (pastPerformances.length === 0) {
    return 'unknown';
  }

  const currentLevel = CLASS_HIERARCHY[currentClass];
  const lastRaceLevel = CLASS_HIERARCHY[pastPerformances[0].classification];

  if (currentLevel < lastRaceLevel) {
    return 'drop';
  } else if (currentLevel > lastRaceLevel) {
    return 'rise';
  } else {
    return 'level';
  }
}

/**
 * Check if horse has proven at this class level
 * Returns true if horse has won or placed at same or higher level
 */
function hasProvenAtClass(
  currentClass: RaceClassification,
  pastPerformances: PastPerformance[]
): { proven: boolean; wins: number; itmCount: number } {
  const currentLevel = CLASS_HIERARCHY[currentClass];

  let wins = 0;
  let itmCount = 0; // In the money (1st, 2nd, 3rd)

  for (const pp of pastPerformances) {
    const ppLevel = CLASS_HIERARCHY[pp.classification];

    // Only count races at same level or higher
    if (ppLevel >= currentLevel) {
      if (pp.finishPosition === 1) wins++;
      if (pp.finishPosition <= 3) itmCount++;
    }
  }

  return {
    proven: wins > 0,
    wins,
    itmCount,
  };
}

/**
 * Check for valid excuse in last race
 * (Wide trip, trouble, blocked, etc.)
 */
function hasValidExcuse(pp: PastPerformance): boolean {
  const excuse = pp.tripComment.toLowerCase();

  const excuseKeywords = [
    'wide',
    'blocked',
    'steadied',
    'bumped',
    'traffic',
    'impeded',
    'checked',
    'shuffled',
    'boxed',
    'crowded',
    'slow start',
    'stumbled',
    'poor break',
    'eased',
  ];

  return excuseKeywords.some((keyword) => excuse.includes(keyword));
}

/**
 * Calculate class level score (0-20 points)
 */
function calculateClassScore(
  currentClass: RaceClassification,
  pastPerformances: PastPerformance[],
  classMovement: 'drop' | 'rise' | 'level' | 'unknown'
): { score: number; reasoning: string } {
  if (pastPerformances.length === 0) {
    return {
      score: 10, // Neutral for first-time starters
      reasoning: 'First-time starter - class unknown',
    };
  }

  const provenData = hasProvenAtClass(currentClass, pastPerformances);
  const lastRace = pastPerformances[0];
  const hasExcuse = hasValidExcuse(lastRace);

  // Proven winner at this level
  if (provenData.proven) {
    return {
      score: 20,
      reasoning: `Proven winner at level (${provenData.wins}W, ${provenData.itmCount} ITM at class)`,
    };
  }

  // Competitive at level (placed but not won)
  if (provenData.itmCount >= 2) {
    return {
      score: 15,
      reasoning: `Competitive at level (${provenData.itmCount} ITM at class)`,
    };
  }

  // Class drop with valid excuse
  if (classMovement === 'drop' && hasExcuse) {
    return {
      score: 18,
      reasoning: `Class drop with excuse: "${lastRace.tripComment.substring(0, 30)}..."`,
    };
  }

  // Simple class drop
  if (classMovement === 'drop') {
    return {
      score: 16,
      reasoning: 'Dropping in class',
    };
  }

  // Class rise
  if (classMovement === 'rise') {
    // Check if horse was competitive in lower class
    const wasCompetitive =
      lastRace.finishPosition <= 3 || (lastRace.finishPosition <= 5 && lastRace.lengthsBehind < 5);

    if (wasCompetitive) {
      return {
        score: 12,
        reasoning: 'Rising in class, competitive last out',
      };
    }

    return {
      score: 10,
      reasoning: 'Rising in class - testing',
    };
  }

  // Level class, not proven
  if (provenData.itmCount >= 1) {
    return {
      score: 12,
      reasoning: 'Placed at level, seeking first win',
    };
  }

  // Overmatched or struggling at level
  const recentPlacings = pastPerformances.slice(0, 3).filter((pp) => pp.finishPosition <= 5).length;

  if (recentPlacings === 0) {
    return {
      score: 5,
      reasoning: 'Struggling at current level',
    };
  }

  return {
    score: 10,
    reasoning: 'Competitive but unproven at level',
  };
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

/**
 * Calculate speed and class score for a horse
 *
 * @param horse - The horse entry to score
 * @param raceHeader - Race information
 * @returns Detailed score breakdown
 */
export function calculateSpeedClassScore(
  horse: HorseEntry,
  raceHeader: RaceHeader
): SpeedClassScoreResult {
  const currentClass = raceHeader.classification;
  const parForClass = CLASS_PAR_FIGURES[currentClass];

  // Get speed figures
  const bestRecentFigure =
    getBestRecentFigure(horse.pastPerformances, 3) ?? getLastBeyerFromEntry(horse);
  const averageFigure = getAverageFigure(horse.pastPerformances, 5) ?? horse.averageBeyer ?? null;

  // Analyze class movement
  const classMovement = analyzeClassMovement(currentClass, horse.pastPerformances);

  // Calculate speed score
  const speedResult = calculateSpeedFigureScore(bestRecentFigure, averageFigure, parForClass);

  // Calculate class score
  const classResult = calculateClassScore(currentClass, horse.pastPerformances, classMovement);

  return {
    total: speedResult.score + classResult.score,
    speedScore: speedResult.score,
    classScore: classResult.score,
    bestRecentFigure,
    averageFigure,
    parForClass,
    classMovement,
    speedReasoning: speedResult.reasoning,
    classReasoning: classResult.reasoning,
  };
}

/**
 * Get par figures for comparison
 * Useful for display and analysis
 */
export function getParFigures(): Record<RaceClassification, number> {
  return { ...CLASS_PAR_FIGURES };
}

/**
 * Get class hierarchy for comparison
 */
export function getClassHierarchy(): Record<RaceClassification, number> {
  return { ...CLASS_HIERARCHY };
}
