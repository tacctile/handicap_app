/**
 * Rank Diagnostics Module
 *
 * READ-ONLY diagnostic logging for analyzing #1 vs #2 horse rankings.
 * Helps identify which scoring categories are causing distortions.
 *
 * Purpose:
 * - Log scoring breakdowns for top horses
 * - Compare #1 vs #2 ranked horses side-by-side
 * - Calculate "rank impact" to identify swing categories
 * - Export data for external analysis
 *
 * IMPORTANT: This module is READ-ONLY. It does NOT modify scoring calculations.
 */

import type { ScoredHorse, ScoreBreakdown } from './index';
import { SCORE_LIMITS } from './index';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Toggle to enable/disable diagnostic mode
 * Set to true to output diagnostics to console
 * Set to false to disable all diagnostic output
 */
export let DIAGNOSTIC_MODE_ENABLED = true;

/**
 * Enable or disable diagnostic mode at runtime
 */
export function setDiagnosticMode(enabled: boolean): void {
  DIAGNOSTIC_MODE_ENABLED = enabled;
  if (enabled) {
    console.log('[RankDiagnostics] Diagnostic mode ENABLED');
  } else {
    console.log('[RankDiagnostics] Diagnostic mode DISABLED');
  }
}

// ============================================================================
// TYPES
// ============================================================================

/**
 * Category breakdown with points and percentage of max
 */
interface CategoryScore {
  category: string;
  points: number;
  maxPoints: number;
  percentage: number;
}

/**
 * Comparison between two horses on a single category
 */
interface CategoryComparison {
  category: string;
  horse1Points: number;
  horse2Points: number;
  differential: number; // positive = horse1 advantage
  winner: '#1' | '#2' | 'tie';
  maxPoints: number;
}

/**
 * Rank impact analysis - would zeroing this category swap #1 and #2?
 */
interface RankImpactResult {
  category: string;
  horse1Points: number;
  horse2Points: number;
  currentGap: number; // #1 baseScore - #2 baseScore
  ifZeroedGap: number; // gap after removing this category from both
  wouldSwapRank: boolean;
  swingPotential: number; // absolute value of the differential
}

/**
 * Complete diagnostic data for a race
 */
export interface RaceDiagnosticData {
  raceId: string;
  timestamp: string;
  horse1: HorseDiagnostic;
  horse2: HorseDiagnostic;
  comparison: {
    totalGap: number;
    categoryComparisons: CategoryComparison[];
    rankImpactAnalysis: RankImpactResult[];
    horse1WinsCategories: string[];
    horse2WinsCategories: string[];
    largestAdvantages: { category: string; differential: number; winner: string }[];
    isCloseCall: boolean; // gap < 10 points
  };
}

/**
 * Diagnostic data for a single horse
 */
interface HorseDiagnostic {
  name: string;
  rank: number;
  baseScore: number;
  totalScore: number;
  categories: CategoryScore[];
}

// ============================================================================
// CATEGORY EXTRACTION
// ============================================================================

/**
 * Extract all category scores from a horse's breakdown
 * Maps breakdown fields to their max points from SCORE_LIMITS
 */
function extractCategoryScores(breakdown: ScoreBreakdown): CategoryScore[] {
  const categories: CategoryScore[] = [];

  // Core categories
  categories.push({
    category: 'Speed/Class',
    points: breakdown.speedClass.total,
    maxPoints: SCORE_LIMITS.speedClass, // 140
    percentage: (breakdown.speedClass.total / SCORE_LIMITS.speedClass) * 100,
  });

  categories.push({
    category: 'Form',
    points: breakdown.form.total,
    maxPoints: SCORE_LIMITS.form, // 42
    percentage: (breakdown.form.total / SCORE_LIMITS.form) * 100,
  });

  categories.push({
    category: 'Pace',
    points: breakdown.pace.total,
    maxPoints: SCORE_LIMITS.pace, // 35
    percentage: (breakdown.pace.total / SCORE_LIMITS.pace) * 100,
  });

  categories.push({
    category: 'Distance/Surface',
    points: breakdown.distanceSurface.total,
    maxPoints: SCORE_LIMITS.distanceSurface, // 25
    percentage: (breakdown.distanceSurface.total / SCORE_LIMITS.distanceSurface) * 100,
  });

  categories.push({
    category: 'Connections',
    points: breakdown.connections.total,
    maxPoints: SCORE_LIMITS.connections, // 23
    percentage: (breakdown.connections.total / SCORE_LIMITS.connections) * 100,
  });

  categories.push({
    category: 'Post Position',
    points: breakdown.postPosition.total,
    maxPoints: SCORE_LIMITS.postPosition, // 12
    percentage: (breakdown.postPosition.total / SCORE_LIMITS.postPosition) * 100,
  });

  categories.push({
    category: 'Odds',
    points: breakdown.odds.total,
    maxPoints: SCORE_LIMITS.odds, // 12
    percentage: (breakdown.odds.total / SCORE_LIMITS.odds) * 100,
  });

  categories.push({
    category: 'Equipment',
    points: breakdown.equipment.total,
    maxPoints: SCORE_LIMITS.equipment, // 8
    percentage: (breakdown.equipment.total / SCORE_LIMITS.equipment) * 100,
  });

  categories.push({
    category: 'Track Specialist',
    points: breakdown.trackSpecialist.total,
    maxPoints: SCORE_LIMITS.trackSpecialist, // 10
    percentage: (breakdown.trackSpecialist.total / SCORE_LIMITS.trackSpecialist) * 100,
  });

  categories.push({
    category: 'Trainer Patterns',
    points: breakdown.trainerPatterns.total,
    maxPoints: SCORE_LIMITS.trainerPatterns, // 8
    percentage: (breakdown.trainerPatterns.total / SCORE_LIMITS.trainerPatterns) * 100,
  });

  categories.push({
    category: 'Trainer S/D',
    points: breakdown.trainerSurfaceDistance.total,
    maxPoints: SCORE_LIMITS.trainerSurfaceDistance, // 6
    percentage:
      (breakdown.trainerSurfaceDistance.total / SCORE_LIMITS.trainerSurfaceDistance) * 100,
  });

  categories.push({
    category: 'Combo Patterns',
    points: breakdown.comboPatterns.total,
    maxPoints: SCORE_LIMITS.comboPatterns, // 4
    percentage: (breakdown.comboPatterns.total / SCORE_LIMITS.comboPatterns) * 100,
  });

  categories.push({
    category: 'Weight',
    points: breakdown.weightAnalysis.total,
    maxPoints: SCORE_LIMITS.weight, // 1
    percentage: (breakdown.weightAnalysis.total / SCORE_LIMITS.weight) * 100,
  });

  // P3 Refinements (if present)
  if (breakdown.ageAnalysis) {
    categories.push({
      category: 'Age Factor',
      points: breakdown.ageAnalysis.adjustment,
      maxPoints: SCORE_LIMITS.ageFactor, // 1
      percentage: Math.abs(breakdown.ageAnalysis.adjustment / SCORE_LIMITS.ageFactor) * 100,
    });
  }

  if (breakdown.siresSireAnalysis) {
    categories.push({
      category: "Sire's Sire",
      points: breakdown.siresSireAnalysis.adjustment,
      maxPoints: SCORE_LIMITS.siresSire, // 1
      percentage: Math.abs(breakdown.siresSireAnalysis.adjustment / SCORE_LIMITS.siresSire) * 100,
    });
  }

  // Sex adjustment (can be negative)
  categories.push({
    category: 'Sex Restriction',
    points: breakdown.sexAnalysis.total,
    maxPoints: 1, // Max penalty is -1
    percentage: Math.abs(breakdown.sexAnalysis.total) * 100,
  });

  return categories;
}

// ============================================================================
// COMPARISON FUNCTIONS
// ============================================================================

/**
 * Compare two horses category by category
 */
function compareCategoryScores(
  horse1Categories: CategoryScore[],
  horse2Categories: CategoryScore[]
): CategoryComparison[] {
  const comparisons: CategoryComparison[] = [];

  for (let i = 0; i < horse1Categories.length; i++) {
    const h1Cat = horse1Categories[i];
    const h2Cat = horse2Categories[i];

    if (!h1Cat || !h2Cat) continue;

    const differential = h1Cat.points - h2Cat.points;
    let winner: '#1' | '#2' | 'tie' = 'tie';
    if (differential > 0) winner = '#1';
    else if (differential < 0) winner = '#2';

    comparisons.push({
      category: h1Cat.category,
      horse1Points: h1Cat.points,
      horse2Points: h2Cat.points,
      differential,
      winner,
      maxPoints: h1Cat.maxPoints,
    });
  }

  return comparisons;
}

/**
 * Calculate rank impact for each category
 * Determines if zeroing that category would swap #1 and #2
 */
function calculateRankImpact(
  horse1: ScoredHorse,
  horse2: ScoredHorse,
  comparisons: CategoryComparison[]
): RankImpactResult[] {
  const currentGap = horse1.score.baseScore - horse2.score.baseScore;
  const results: RankImpactResult[] = [];

  for (const comp of comparisons) {
    // If we zeroed this category for both horses, what would the new gap be?
    const ifZeroedGap = currentGap - comp.differential;

    results.push({
      category: comp.category,
      horse1Points: comp.horse1Points,
      horse2Points: comp.horse2Points,
      currentGap,
      ifZeroedGap,
      wouldSwapRank: ifZeroedGap < 0, // Negative means #2 would be ahead
      swingPotential: Math.abs(comp.differential),
    });
  }

  // Sort by swing potential (highest first)
  return results.sort((a, b) => b.swingPotential - a.swingPotential);
}

// ============================================================================
// CONSOLE OUTPUT FUNCTIONS
// ============================================================================

/**
 * Log a single horse's scoring breakdown
 */
function logHorseBreakdown(horse: ScoredHorse, categories: CategoryScore[]): void {
  console.log(`\n  📊 ${horse.horse.horseName} (Rank #${horse.rank})`);
  console.log(`     Base Score: ${horse.score.baseScore} | Total: ${horse.score.total}`);
  console.log(`     ──────────────────────────────────────────`);

  for (const cat of categories) {
    const bar = '█'.repeat(Math.round(cat.percentage / 10));
    const spaces = ' '.repeat(10 - Math.round(cat.percentage / 10));
    console.log(
      `     ${cat.category.padEnd(18)} ${cat.points.toString().padStart(3)}/${cat.maxPoints.toString().padStart(3)} pts [${bar}${spaces}] ${cat.percentage.toFixed(0)}%`
    );
  }
}

/**
 * Log side-by-side comparison of #1 vs #2
 */
function logComparison(
  horse1: ScoredHorse,
  horse2: ScoredHorse,
  comparisons: CategoryComparison[],
  rankImpacts: RankImpactResult[]
): void {
  const gap = horse1.score.baseScore - horse2.score.baseScore;
  const isCloseCall = Math.abs(gap) < 10;

  console.log(`\n  ⚖️  HEAD-TO-HEAD COMPARISON`);
  console.log(`     ════════════════════════════════════════════════════════════`);
  console.log(`     ${horse1.horse.horseName.padEnd(20)} vs ${horse2.horse.horseName.padEnd(20)}`);
  console.log(
    `     Base: ${horse1.score.baseScore}`.padEnd(25) + `Base: ${horse2.score.baseScore}`
  );
  console.log(`     Gap: ${gap} points ${isCloseCall ? '⚠️ CLOSE CALL' : ''}`);
  console.log(`     ──────────────────────────────────────────────────────────────`);

  // Category by category
  console.log(`\n     CATEGORY                #1 pts    #2 pts    Diff    Winner`);
  console.log(`     ─────────────────────────────────────────────────────────────`);

  for (const comp of comparisons) {
    const diffStr =
      comp.differential > 0
        ? `+${comp.differential}`
        : comp.differential < 0
          ? `${comp.differential}`
          : '0';
    const winnerStr = comp.winner === '#1' ? '← #1' : comp.winner === '#2' ? '#2 →' : 'TIE';
    console.log(
      `     ${comp.category.padEnd(20)} ${comp.horse1Points.toString().padStart(5)}     ${comp.horse2Points.toString().padStart(5)}     ${diffStr.padStart(5)}    ${winnerStr}`
    );
  }

  // Category wins summary
  const h1Wins = comparisons.filter((c) => c.winner === '#1').map((c) => c.category);
  const h2Wins = comparisons.filter((c) => c.winner === '#2').map((c) => c.category);

  console.log(`\n     #1 wins on: ${h1Wins.join(', ') || 'none'}`);
  console.log(`     #2 wins on: ${h2Wins.join(', ') || 'none'}`);

  // Largest advantages
  const topAdvantages = comparisons
    .filter((c) => c.winner !== 'tie')
    .sort((a, b) => Math.abs(b.differential) - Math.abs(a.differential))
    .slice(0, 3);

  console.log(`\n     TOP 3 LARGEST ADVANTAGES:`);
  for (const adv of topAdvantages) {
    const winner = adv.differential > 0 ? horse1.horse.horseName : horse2.horse.horseName;
    console.log(`       • ${adv.category}: ${winner} by ${Math.abs(adv.differential)} pts`);
  }

  // Rank impact analysis
  console.log(`\n  🔍 RANK IMPACT ANALYSIS`);
  console.log(`     (Categories that could swap #1/#2 if zeroed)`);
  console.log(`     ──────────────────────────────────────────────────────────────`);

  const swingCategories = rankImpacts.filter((r) => r.wouldSwapRank);
  if (swingCategories.length === 0) {
    console.log(`     No single category would swap the ranking if zeroed.`);
  } else {
    console.log(`     ⚠️ ${swingCategories.length} categories could swing the result:\n`);
    for (const swing of swingCategories) {
      console.log(
        `       • ${swing.category}: #1 has ${swing.horse1Points}, #2 has ${swing.horse2Points} (+${swing.swingPotential} swing)`
      );
    }
  }

  // Flag specific categories per user request
  console.log(`\n  🎯 TARGETED CATEGORY REVIEW`);
  const targetCategories = ['Connections', 'Form', 'Equipment', 'Post Position'];
  for (const targetCat of targetCategories) {
    const comp = comparisons.find((c) => c.category === targetCat);
    const impact = rankImpacts.find((r) => r.category === targetCat);
    if (comp && impact) {
      const status = impact.wouldSwapRank ? '⚠️ COULD SWAP RANKS' : '✓ Stable';
      console.log(
        `     ${targetCat.padEnd(15)}: #1=${comp.horse1Points}, #2=${comp.horse2Points}, diff=${comp.differential > 0 ? '+' : ''}${comp.differential} [${status}]`
      );
    }
  }
}

// ============================================================================
// MAIN DIAGNOSTIC FUNCTION
// ============================================================================

/**
 * Generate full diagnostic report for a race
 * Call this after calculateRaceScores() with the scored horses
 *
 * @param scoredHorses - Array of scored horses from calculateRaceScores()
 * @param raceId - Optional race identifier for logging
 */
export function logRankDiagnostics(
  scoredHorses: ScoredHorse[],
  raceId?: string
): RaceDiagnosticData | null {
  // Skip if diagnostic mode is disabled
  if (!DIAGNOSTIC_MODE_ENABLED) {
    return null;
  }

  // Filter to non-scratched horses and sort by rank
  const activeHorses = scoredHorses
    .filter((h) => !h.score.isScratched && h.rank > 0)
    .sort((a, b) => a.rank - b.rank);

  // Need at least 2 horses for comparison
  if (activeHorses.length < 2) {
    console.log('[RankDiagnostics] Not enough active horses for comparison');
    return null;
  }

  const horse1 = activeHorses[0]!;
  const horse2 = activeHorses[1]!;

  // Extract category scores
  const h1Categories = extractCategoryScores(horse1.score.breakdown);
  const h2Categories = extractCategoryScores(horse2.score.breakdown);

  // Generate comparisons
  const comparisons = compareCategoryScores(h1Categories, h2Categories);
  const rankImpacts = calculateRankImpact(horse1, horse2, comparisons);

  // Console output
  const raceLabel = raceId ? `Race: ${raceId}` : 'Race Analysis';
  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  🏇 RANK DIAGNOSTICS - ${raceLabel.padEnd(40)} ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);

  // Log individual breakdowns
  logHorseBreakdown(horse1, h1Categories);
  logHorseBreakdown(horse2, h2Categories);

  // Log comparison
  logComparison(horse1, horse2, comparisons, rankImpacts);

  // Build diagnostic data object for JSON export
  const gap = horse1.score.baseScore - horse2.score.baseScore;
  const h1WinsCategories = comparisons.filter((c) => c.winner === '#1').map((c) => c.category);
  const h2WinsCategories = comparisons.filter((c) => c.winner === '#2').map((c) => c.category);
  const largestAdvantages = comparisons
    .filter((c) => c.winner !== 'tie')
    .sort((a, b) => Math.abs(b.differential) - Math.abs(a.differential))
    .slice(0, 5)
    .map((c) => ({
      category: c.category,
      differential: Math.abs(c.differential),
      winner: c.differential > 0 ? horse1.horse.horseName : horse2.horse.horseName,
    }));

  const diagnosticData: RaceDiagnosticData = {
    raceId: raceId || 'unknown',
    timestamp: new Date().toISOString(),
    horse1: {
      name: horse1.horse.horseName,
      rank: horse1.rank,
      baseScore: horse1.score.baseScore,
      totalScore: horse1.score.total,
      categories: h1Categories,
    },
    horse2: {
      name: horse2.horse.horseName,
      rank: horse2.rank,
      baseScore: horse2.score.baseScore,
      totalScore: horse2.score.total,
      categories: h2Categories,
    },
    comparison: {
      totalGap: gap,
      categoryComparisons: comparisons,
      rankImpactAnalysis: rankImpacts,
      horse1WinsCategories: h1WinsCategories,
      horse2WinsCategories: h2WinsCategories,
      largestAdvantages,
      isCloseCall: Math.abs(gap) < 10,
    },
  };

  // Log JSON export hint
  console.log(`\n  💾 JSON Export available - call getDiagnosticJSON() or check return value`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);

  return diagnosticData;
}

/**
 * Get diagnostic data as JSON string for external analysis
 */
export function getDiagnosticJSON(data: RaceDiagnosticData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Log a compact summary suitable for quick review
 */
export function logCompactDiagnostic(scoredHorses: ScoredHorse[], raceId?: string): void {
  if (!DIAGNOSTIC_MODE_ENABLED) return;

  const activeHorses = scoredHorses
    .filter((h) => !h.score.isScratched && h.rank > 0)
    .sort((a, b) => a.rank - b.rank);

  if (activeHorses.length < 2) return;

  const h1 = activeHorses[0]!;
  const h2 = activeHorses[1]!;
  const gap = h1.score.baseScore - h2.score.baseScore;
  const closeFlag = Math.abs(gap) < 10 ? ' ⚠️ CLOSE' : '';

  console.log(
    `[Rank] ${raceId || 'Race'}: #1 ${h1.horse.horseName} (${h1.score.baseScore}) vs #2 ${h2.horse.horseName} (${h2.score.baseScore}) | Gap: ${gap}${closeFlag}`
  );
}

// ============================================================================
// AGGREGATE ANALYSIS
// ============================================================================

/**
 * Store for collecting diagnostic data across multiple races
 */
const diagnosticHistory: RaceDiagnosticData[] = [];

/**
 * Add diagnostic data to history for aggregate analysis
 */
export function addToHistory(data: RaceDiagnosticData): void {
  diagnosticHistory.push(data);
}

/**
 * Get all collected diagnostic data
 */
export function getDiagnosticHistory(): RaceDiagnosticData[] {
  return [...diagnosticHistory];
}

/**
 * Clear diagnostic history
 */
export function clearDiagnosticHistory(): void {
  diagnosticHistory.length = 0;
}

/**
 * Generate aggregate analysis across multiple races
 * Shows which categories most frequently cause rank swings
 */
export function logAggregateAnalysis(): void {
  if (diagnosticHistory.length === 0) {
    console.log('[RankDiagnostics] No diagnostic data collected. Run races first.');
    return;
  }

  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(
    `║  📈 AGGREGATE RANK ANALYSIS (${diagnosticHistory.length} races)                          ║`
  );
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);

  // Count how often each category is a "swing" category
  const swingCounts: Record<string, number> = {};
  const totalDifferentials: Record<string, number> = {};
  let closeCallCount = 0;

  for (const data of diagnosticHistory) {
    if (data.comparison.isCloseCall) closeCallCount++;

    for (const impact of data.comparison.rankImpactAnalysis) {
      if (swingCounts[impact.category] === undefined) {
        swingCounts[impact.category] = 0;
        totalDifferentials[impact.category] = 0;
      }
      if (impact.wouldSwapRank) {
        swingCounts[impact.category] = (swingCounts[impact.category] ?? 0) + 1;
      }
      totalDifferentials[impact.category] =
        (totalDifferentials[impact.category] ?? 0) + impact.swingPotential;
    }
  }

  console.log(
    `\n  Close calls (gap < 10 pts): ${closeCallCount}/${diagnosticHistory.length} races (${((closeCallCount / diagnosticHistory.length) * 100).toFixed(0)}%)`
  );

  console.log(`\n  CATEGORIES BY SWING FREQUENCY:`);
  console.log(`  ─────────────────────────────────────────`);

  const sortedCategories = Object.entries(swingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [category, count] of sortedCategories) {
    const avgDiff = totalDifferentials[category]
      ? (totalDifferentials[category] / diagnosticHistory.length).toFixed(1)
      : '0';
    const swingPct = ((count / diagnosticHistory.length) * 100).toFixed(0);
    console.log(
      `  ${category.padEnd(20)} ${count} swings (${swingPct}%) | Avg diff: ${avgDiff} pts`
    );
  }

  console.log(`\n  CATEGORIES BY TOTAL IMPACT:`);
  console.log(`  ─────────────────────────────────────────`);

  const sortedByImpact = Object.entries(totalDifferentials)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [category, totalDiff] of sortedByImpact) {
    const avgDiff = (totalDiff / diagnosticHistory.length).toFixed(1);
    console.log(`  ${category.padEnd(20)} Total: ${totalDiff} pts | Avg: ${avgDiff} pts/race`);
  }

  console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { CategoryScore, CategoryComparison, RankImpactResult, HorseDiagnostic };
