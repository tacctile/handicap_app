/**
 * Scoring Diagnostics Module
 *
 * Provides tools to diagnose why favorites may rank lower than expected.
 * This is a diagnostic-only module - it does not modify scoring logic.
 *
 * Key diagnostic capabilities:
 * 1. Category weight analysis comparing to industry standards
 * 2. Per-horse scoring breakdown with issue flagging
 * 3. Market odds vs model disagreement detection
 * 4. Systematic issue identification across scoring modules
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { TrackCondition } from '../../hooks/useRaceState';
import { calculateHorseScore, SCORE_LIMITS, MAX_BASE_SCORE, type HorseScore } from './index';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Category score breakdown with percentage calculation
 */
export interface CategoryScoreAnalysis {
  /** Raw score achieved in this category */
  score: number;
  /** Maximum possible score for this category */
  max: number;
  /** Percentage of max (0-100) */
  percent: number;
  /** Category name for display */
  name: string;
  /** Issues detected for this category */
  issues: string[];
}

/**
 * Comprehensive diagnostic result for a single horse
 */
export interface HorseDiagnostic {
  /** Horse name for identification */
  horseName: string;
  /** Program number */
  programNumber: number;
  /** Morning line odds */
  morningLineOdds: string;
  /** Market-implied win probability (from odds) */
  marketImpliedWinProb: number;
  /** Model-implied win probability (from score) */
  modelImpliedWinProb: number;
  /** Disagreement level between market and model */
  disagreementLevel: 'low' | 'medium' | 'high' | 'extreme';
  /** Disagreement percentage (positive = model higher, negative = market higher) */
  disagreementPercent: number;
  /** Total base score */
  baseScore: number;
  /** Total final score */
  totalScore: number;
  /** Detailed category analysis */
  categoryScores: Record<string, CategoryScoreAnalysis>;
  /** Categories where horse scores <50% of max */
  weakestCategories: string[];
  /** Categories where horse scores >75% of max */
  strongestCategories: string[];
  /** Potential issues identified */
  potentialIssues: string[];
  /** Flags for why a favorite might rank low */
  favoriteFlags: string[];
}

/**
 * Weight distribution analysis comparing current vs industry standard
 */
export interface WeightDistributionAnalysis {
  /** Category name */
  category: string;
  /** Current max points in this category */
  currentPoints: number;
  /** Current percentage of total base score */
  currentPercent: number;
  /** Industry standard percentage range (low-high) */
  industryStandardRange: { low: number; high: number };
  /** Whether current weight is aligned with industry */
  alignment: 'under' | 'aligned' | 'over';
  /** Recommendation if any */
  recommendation?: string;
}

/**
 * Field-level diagnostic summary
 */
export interface FieldDiagnostic {
  /** All horse diagnostics */
  horses: HorseDiagnostic[];
  /** Identified systematic issues */
  systematicIssues: string[];
  /** Weight distribution analysis */
  weightAnalysis: WeightDistributionAnalysis[];
  /** Summary statistics */
  summary: {
    totalHorses: number;
    highDisagreementCount: number;
    avgFavoriteRank: number;
    favoritesInTop3: number;
  };
}

// ============================================================================
// CONSTANTS - INDUSTRY STANDARD WEIGHTS
// ============================================================================

/**
 * Industry standard handicapping weight ranges (as percentage of total)
 * Based on professional handicapping research and established methodologies
 */
export const INDUSTRY_STANDARD_WEIGHTS: Record<string, { low: number; high: number }> = {
  // Primary predictive factors
  speedClass: { low: 25, high: 35 }, // Speed figures: typically 25-35%
  pace: { low: 10, high: 15 }, // Pace analysis: typically 10-15%
  form: { low: 20, high: 25 }, // Recent form: typically 20-25%

  // Secondary factors
  postPosition: { low: 3, high: 8 }, // Post position: typically 3-5% (situational)
  connections: { low: 5, high: 10 }, // Trainer/jockey: typically 5-10%
  equipment: { low: 2, high: 5 }, // Equipment changes: typically 2-5%

  // Bonus categories (typically informational, not weighted heavily)
  distanceSurface: { low: 3, high: 8 }, // Distance/surface affinity
  trainerPatterns: { low: 0, high: 5 }, // Trainer situational patterns
  comboPatterns: { low: 0, high: 5 }, // Combo patterns
  trackSpecialist: { low: 0, high: 3 }, // Track specialist
  trainerSurfaceDistance: { low: 0, high: 3 }, // Trainer surface/distance
};

/**
 * Current weight distribution from SCORE_LIMITS
 */
export const CURRENT_WEIGHTS = {
  connections: {
    points: SCORE_LIMITS.connections,
    percent: (SCORE_LIMITS.connections / MAX_BASE_SCORE) * 100,
  },
  postPosition: {
    points: SCORE_LIMITS.postPosition,
    percent: (SCORE_LIMITS.postPosition / MAX_BASE_SCORE) * 100,
  },
  speedClass: {
    points: SCORE_LIMITS.speedClass,
    percent: (SCORE_LIMITS.speedClass / MAX_BASE_SCORE) * 100,
  },
  form: {
    points: SCORE_LIMITS.form,
    percent: (SCORE_LIMITS.form / MAX_BASE_SCORE) * 100,
  },
  equipment: {
    points: SCORE_LIMITS.equipment,
    percent: (SCORE_LIMITS.equipment / MAX_BASE_SCORE) * 100,
  },
  pace: {
    points: SCORE_LIMITS.pace,
    percent: (SCORE_LIMITS.pace / MAX_BASE_SCORE) * 100,
  },
  distanceSurface: {
    points: SCORE_LIMITS.distanceSurface,
    percent: (SCORE_LIMITS.distanceSurface / MAX_BASE_SCORE) * 100,
  },
  trainerPatterns: {
    points: SCORE_LIMITS.trainerPatterns,
    percent: (SCORE_LIMITS.trainerPatterns / MAX_BASE_SCORE) * 100,
  },
  comboPatterns: {
    points: SCORE_LIMITS.comboPatterns,
    percent: (SCORE_LIMITS.comboPatterns / MAX_BASE_SCORE) * 100,
  },
  trackSpecialist: {
    points: SCORE_LIMITS.trackSpecialist,
    percent: (SCORE_LIMITS.trackSpecialist / MAX_BASE_SCORE) * 100,
  },
  trainerSurfaceDistance: {
    points: SCORE_LIMITS.trainerSurfaceDistance,
    percent: (SCORE_LIMITS.trainerSurfaceDistance / MAX_BASE_SCORE) * 100,
  },
  weight: {
    points: SCORE_LIMITS.weight,
    percent: (SCORE_LIMITS.weight / MAX_BASE_SCORE) * 100,
  },
  ageFactor: {
    points: SCORE_LIMITS.ageFactor,
    percent: (SCORE_LIMITS.ageFactor / MAX_BASE_SCORE) * 100,
  },
  siresSire: {
    points: SCORE_LIMITS.siresSire,
    percent: (SCORE_LIMITS.siresSire / MAX_BASE_SCORE) * 100,
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse odds string to decimal odds
 * Handles formats like "3-1", "5/2", "3.5", "EVEN"
 */
function parseOddsToDecimal(oddsStr: string): number {
  const cleaned = oddsStr.trim().toUpperCase();

  if (cleaned === 'EVEN' || cleaned === 'EVN' || cleaned === '1-1') {
    return 1.0;
  }

  // Handle "X-1" format (e.g., "5-1")
  if (cleaned.includes('-')) {
    const parts = cleaned.split('-');
    const num = parts[0];
    return num ? parseFloat(num) || 10 : 10;
  }

  // Handle "X/Y" format (e.g., "5/2")
  if (cleaned.includes('/')) {
    const parts = cleaned.split('/');
    const num = parts[0];
    const denom = parts[1];
    const numerator = num ? parseFloat(num) : 0;
    const denominator = denom ? parseFloat(denom) : 1;
    return numerator / (denominator || 1);
  }

  return parseFloat(cleaned) || 10;
}

/**
 * Convert odds to implied win probability
 * e.g., 1-1 (even money) = 50%, 2-1 = 33%, 5-1 = 16.7%
 */
function oddsToWinProbability(oddsDecimal: number): number {
  // odds represent X-1, so probability = 1 / (odds + 1)
  return (1 / (oddsDecimal + 1)) * 100;
}

/**
 * Convert score to implied win probability
 * Uses a logistic function calibrated to scoring range
 */
function scoreToWinProbability(score: number, _fieldSize: number): number {
  // Simplified: assume score distribution and convert to probability
  // For a field of N horses, a "neutral" score would be ~1/N probability
  // Higher scores should have higher probability, but capped at realistic ranges

  // Use a simple linear scaling with bounds
  // Elite (200+) = ~35-50% in small fields
  // Strong (180) = ~20-30%
  // Good (160) = ~12-18%
  // Fair (140) = ~8-12%
  // Weak (<140) = ~5-8%

  if (score >= 200) return Math.min(50, 25 + ((score - 200) / 50) * 25);
  if (score >= 180) return 20 + ((score - 180) / 20) * 5;
  if (score >= 160) return 12 + ((score - 160) / 20) * 8;
  if (score >= 140) return 8 + ((score - 140) / 20) * 4;
  return Math.max(2, 8 - ((140 - score) / 40) * 6);
}

/**
 * Determine disagreement level between market and model
 */
function getDisagreementLevel(percentDiff: number): 'low' | 'medium' | 'high' | 'extreme' {
  const absDiff = Math.abs(percentDiff);
  if (absDiff > 25) return 'extreme';
  if (absDiff > 15) return 'high';
  if (absDiff > 8) return 'medium';
  return 'low';
}

/**
 * Identify issues for a category score
 */
function identifyCategoryIssues(
  categoryName: string,
  score: number,
  max: number,
  horse: HorseEntry
): string[] {
  const issues: string[] = [];
  const percent = max > 0 ? (score / max) * 100 : 0;

  // Generic low score warning
  if (percent < 30) {
    issues.push(`Very low score (${percent.toFixed(0)}% of max)`);
  }

  // Category-specific issues
  switch (categoryName) {
    case 'connections':
      if (horse.trainerMeetStarts !== null && horse.trainerMeetStarts < 3) {
        issues.push('Trainer has <3 meet starts - using neutral score');
      }
      if (horse.jockeyMeetStarts !== null && horse.jockeyMeetStarts < 3) {
        issues.push('Jockey has <3 meet starts - using neutral score');
      }
      break;

    case 'speedClass':
      if (horse.bestBeyer === null && horse.averageBeyer === null) {
        issues.push('No Beyer figures available - using neutral score');
      }
      break;

    case 'form':
      if (horse.pastPerformances.length === 0) {
        issues.push('No past performances - first time starter');
      } else if (horse.pastPerformances.length < 3) {
        issues.push('Limited race history (<3 races)');
      }
      break;

    case 'distanceSurface':
      if ((horse.turfStarts ?? 0) === 0 && (horse.wetTrackStarts ?? 0) === 0) {
        issues.push('No turf or wet track experience - may be getting 0 for bonus categories');
      }
      break;

    case 'trackSpecialist':
      if ((horse.trackRecordStarts ?? 0) < 4) {
        issues.push('Less than 4 starts at track - no track specialist bonus possible');
      }
      break;

    case 'trainerPatterns': {
      // Check if trainer stats exist
      const stats = horse.trainerCategoryStats;
      if (
        stats.firstTimeLasix.starts < 5 &&
        stats.firstTimeBlinkers.starts < 5 &&
        stats.secondOffLayoff.starts < 5
      ) {
        issues.push('Trainer lacks pattern data with 5+ starts');
      }
      break;
    }

    case 'comboPatterns': {
      // Combos favor class droppers
      const isStable =
        horse.pastPerformances.length > 0 &&
        !horse.equipment.firstTimeEquipment.length &&
        !horse.medication.lasixFirstTime;
      if (isStable) {
        issues.push(
          'Stable horse (no class drop, no equipment change) - fewer combo opportunities'
        );
      }
      break;
    }
  }

  return issues;
}

/**
 * Identify why a favorite might be ranking low
 */
function identifyFavoriteIssues(
  horse: HorseEntry,
  score: HorseScore,
  marketProb: number
): string[] {
  const issues: string[] = [];

  // Only check if horse is a favorite (>25% implied probability = better than 3-1)
  if (marketProb < 25) return issues;

  const breakdown = score.breakdown;

  // Check for missing bonus categories
  const bonusCategories = {
    distanceSurface: {
      score: breakdown.distanceSurface.total,
      max: SCORE_LIMITS.distanceSurface,
    },
    trainerPatterns: {
      score: breakdown.trainerPatterns.total,
      max: SCORE_LIMITS.trainerPatterns,
    },
    comboPatterns: {
      score: breakdown.comboPatterns.total,
      max: SCORE_LIMITS.comboPatterns,
    },
    trackSpecialist: {
      score: breakdown.trackSpecialist.total,
      max: SCORE_LIMITS.trackSpecialist,
    },
    trainerSurfaceDistance: {
      score: breakdown.trainerSurfaceDistance.total,
      max: SCORE_LIMITS.trainerSurfaceDistance,
    },
  };

  let totalMissedBonus = 0;
  for (const [name, data] of Object.entries(bonusCategories)) {
    if (data.score === 0 && data.max > 0) {
      totalMissedBonus += data.max;
      issues.push(`${name}: 0/${data.max} pts (bonus not triggered)`);
    }
  }

  if (totalMissedBonus >= 30) {
    issues.push(`CRITICAL: Missing ${totalMissedBonus} bonus points from situational categories`);
  }

  // Check core categories for favorites
  const coreExpectations = [
    {
      name: 'connections',
      score: breakdown.connections.total,
      max: SCORE_LIMITS.connections,
      minExpectedPercent: 60,
    },
    {
      name: 'speedClass',
      score: breakdown.speedClass.total,
      max: SCORE_LIMITS.speedClass,
      minExpectedPercent: 50,
    },
    {
      name: 'form',
      score: breakdown.form.total,
      max: SCORE_LIMITS.form,
      minExpectedPercent: 50,
    },
  ];

  for (const exp of coreExpectations) {
    const percent = (exp.score / exp.max) * 100;
    if (percent < exp.minExpectedPercent) {
      issues.push(
        `${exp.name}: ${percent.toFixed(0)}% (expected >${exp.minExpectedPercent}% for favorite)`
      );
    }
  }

  // Check if horse won last race but form score is low
  if (horse.pastPerformances.length > 0) {
    const lastPP = horse.pastPerformances[0];
    if (lastPP && lastPP.finishPosition === 1) {
      const formPercent = (breakdown.form.total / SCORE_LIMITS.form) * 100;
      if (formPercent < 70) {
        issues.push(
          `Won last race but form score only ${formPercent.toFixed(0)}% - check weighted averaging`
        );
      }
    }
  }

  return issues;
}

// ============================================================================
// MAIN DIAGNOSTIC FUNCTIONS
// ============================================================================

/**
 * Diagnose scoring for a single horse
 */
export function diagnoseHorseScoring(
  horse: HorseEntry,
  raceHeader: RaceHeader,
  trackCondition: TrackCondition = 'fast',
  fieldSize: number = 6
): HorseDiagnostic {
  // Calculate full score
  const score = calculateHorseScore(
    horse,
    raceHeader,
    horse.morningLineOdds,
    trackCondition,
    false
  );

  // Parse odds and calculate probabilities
  const oddsDecimal = parseOddsToDecimal(horse.morningLineOdds);
  const marketImpliedWinProb = oddsToWinProbability(oddsDecimal);
  const modelImpliedWinProb = scoreToWinProbability(score.total, fieldSize);

  // Calculate disagreement
  const disagreementPercent = modelImpliedWinProb - marketImpliedWinProb;
  const disagreementLevel = getDisagreementLevel(disagreementPercent);

  // Build category analysis
  const categoryScores: Record<string, CategoryScoreAnalysis> = {};
  const breakdown = score.breakdown;

  const categories = [
    { key: 'connections', score: breakdown.connections.total, max: SCORE_LIMITS.connections },
    {
      key: 'postPosition',
      score: breakdown.postPosition.total,
      max: SCORE_LIMITS.postPosition,
    },
    { key: 'speedClass', score: breakdown.speedClass.total, max: SCORE_LIMITS.speedClass },
    { key: 'form', score: breakdown.form.total, max: SCORE_LIMITS.form },
    { key: 'equipment', score: breakdown.equipment.total, max: SCORE_LIMITS.equipment },
    { key: 'pace', score: breakdown.pace.total, max: SCORE_LIMITS.pace },
    {
      key: 'distanceSurface',
      score: breakdown.distanceSurface.total,
      max: SCORE_LIMITS.distanceSurface,
    },
    {
      key: 'trainerPatterns',
      score: breakdown.trainerPatterns.total,
      max: SCORE_LIMITS.trainerPatterns,
    },
    {
      key: 'comboPatterns',
      score: breakdown.comboPatterns.total,
      max: SCORE_LIMITS.comboPatterns,
    },
    {
      key: 'trackSpecialist',
      score: breakdown.trackSpecialist.total,
      max: SCORE_LIMITS.trackSpecialist,
    },
    {
      key: 'trainerSurfaceDistance',
      score: breakdown.trainerSurfaceDistance.total,
      max: SCORE_LIMITS.trainerSurfaceDistance,
    },
  ];

  const weakestCategories: string[] = [];
  const strongestCategories: string[] = [];
  const allIssues: string[] = [];

  for (const cat of categories) {
    const percent = cat.max > 0 ? (cat.score / cat.max) * 100 : 0;
    const issues = identifyCategoryIssues(cat.key, cat.score, cat.max, horse);

    categoryScores[cat.key] = {
      score: cat.score,
      max: cat.max,
      percent,
      name: cat.key,
      issues,
    };

    if (percent < 50) {
      weakestCategories.push(cat.key);
    }
    if (percent > 75) {
      strongestCategories.push(cat.key);
    }

    allIssues.push(...issues);
  }

  // Identify favorite-specific issues
  const favoriteFlags = identifyFavoriteIssues(horse, score, marketImpliedWinProb);

  return {
    horseName: horse.horseName,
    programNumber: horse.programNumber,
    morningLineOdds: horse.morningLineOdds,
    marketImpliedWinProb,
    modelImpliedWinProb,
    disagreementLevel,
    disagreementPercent,
    baseScore: score.baseScore,
    totalScore: score.total,
    categoryScores,
    weakestCategories,
    strongestCategories,
    potentialIssues: allIssues,
    favoriteFlags,
  };
}

/**
 * Analyze weight distribution compared to industry standards
 */
export function analyzeWeightDistribution(): WeightDistributionAnalysis[] {
  const analysis: WeightDistributionAnalysis[] = [];

  for (const [category, weights] of Object.entries(CURRENT_WEIGHTS)) {
    const standard = INDUSTRY_STANDARD_WEIGHTS[category];
    if (!standard) continue;

    let alignment: 'under' | 'aligned' | 'over' = 'aligned';
    let recommendation: string | undefined;

    if (weights.percent < standard.low) {
      alignment = 'under';
      recommendation = `Consider increasing weight (industry: ${standard.low}-${standard.high}%)`;
    } else if (weights.percent > standard.high) {
      alignment = 'over';
      recommendation = `Consider reducing weight (industry: ${standard.low}-${standard.high}%)`;
    }

    analysis.push({
      category,
      currentPoints: weights.points,
      currentPercent: weights.percent,
      industryStandardRange: standard,
      alignment,
      recommendation,
    });
  }

  return analysis;
}

/**
 * Get a formatted weight distribution table
 */
export function getWeightDistributionTable(): string {
  const rows: string[] = [];

  rows.push('');
  rows.push('='.repeat(80));
  rows.push('CATEGORY WEIGHT DISTRIBUTION');
  rows.push('='.repeat(80));
  rows.push('');
  rows.push('Category                    Points    Current%    Industry Standard    Status');
  rows.push('-'.repeat(80));

  const orderedCategories = [
    'speedClass',
    'pace',
    'form',
    'postPosition',
    'connections',
    'equipment',
    'distanceSurface',
    'trainerPatterns',
    'comboPatterns',
    'trackSpecialist',
    'trainerSurfaceDistance',
    'weight',
    'ageFactor',
    'siresSire',
  ];

  let coreTotal = 0;
  let bonusTotal = 0;
  const coreCategories = ['speedClass', 'pace', 'form', 'postPosition', 'connections', 'equipment'];

  for (const category of orderedCategories) {
    const weights = CURRENT_WEIGHTS[category as keyof typeof CURRENT_WEIGHTS];
    if (!weights) continue;

    const standard = INDUSTRY_STANDARD_WEIGHTS[category];
    const standardStr = standard ? `${standard.low}-${standard.high}%` : 'N/A';

    let status = '';
    if (standard) {
      if (weights.percent < standard.low) {
        status = 'UNDER';
      } else if (weights.percent > standard.high) {
        status = 'OVER';
      } else {
        status = 'OK';
      }
    }

    if (coreCategories.includes(category)) {
      coreTotal += weights.points;
    } else {
      bonusTotal += weights.points;
    }

    rows.push(
      `${category.padEnd(26)} ${String(weights.points).padStart(4)}      ${weights.percent.toFixed(1).padStart(5)}%       ${standardStr.padEnd(15)}    ${status}`
    );
  }

  rows.push('-'.repeat(80));
  rows.push(
    `Core Categories Total:      ${coreTotal} pts (${((coreTotal / MAX_BASE_SCORE) * 100).toFixed(1)}%)`
  );
  rows.push(
    `Bonus Categories Total:     ${bonusTotal} pts (${((bonusTotal / MAX_BASE_SCORE) * 100).toFixed(1)}%)`
  );
  rows.push(`TOTAL BASE SCORE:           ${MAX_BASE_SCORE} pts`);
  rows.push('');

  return rows.join('\n');
}

/**
 * Diagnose an entire field
 */
export function diagnoseField(
  horses: HorseEntry[],
  raceHeader: RaceHeader,
  trackCondition: TrackCondition = 'fast'
): FieldDiagnostic {
  const diagnostics: HorseDiagnostic[] = [];
  const fieldSize = horses.length;

  // Get diagnostics for each horse
  for (const horse of horses) {
    diagnostics.push(diagnoseHorseScoring(horse, raceHeader, trackCondition, fieldSize));
  }

  // Sort by odds (lowest odds = favorite first)
  const sortedByOdds = [...diagnostics].sort(
    (a, b) => parseOddsToDecimal(a.morningLineOdds) - parseOddsToDecimal(b.morningLineOdds)
  );

  // Sort by score (highest score first)
  const sortedByScore = [...diagnostics].sort((a, b) => b.totalScore - a.totalScore);

  // Identify systematic issues
  const systematicIssues: string[] = [];

  // Check if favorites consistently rank low
  const top3Favorites = sortedByOdds.slice(0, 3);
  let favoriteRankSum = 0;
  let favoritesInTop3 = 0;

  for (const fav of top3Favorites) {
    const rank = sortedByScore.findIndex((h) => h.programNumber === fav.programNumber) + 1;
    favoriteRankSum += rank;
    if (rank <= 3) favoritesInTop3++;
  }

  const avgFavoriteRank = favoriteRankSum / top3Favorites.length;

  if (avgFavoriteRank > fieldSize * 0.6) {
    systematicIssues.push(
      `CRITICAL: Top 3 betting choices averaging rank ${avgFavoriteRank.toFixed(1)} (bottom half of field)`
    );
  }

  // Check for common issues across favorites
  const commonIssues: Record<string, number> = {};
  for (const fav of top3Favorites) {
    for (const issue of fav.favoriteFlags) {
      commonIssues[issue] = (commonIssues[issue] || 0) + 1;
    }
  }

  for (const [issue, count] of Object.entries(commonIssues)) {
    if (count >= 2) {
      systematicIssues.push(`Recurring issue (${count}/3 favorites): ${issue}`);
    }
  }

  // Check bonus category distribution
  const bonusCategoryNames = [
    'distanceSurface',
    'trainerPatterns',
    'comboPatterns',
    'trackSpecialist',
    'trainerSurfaceDistance',
  ];

  let totalBonusForFavorites = 0;
  let totalBonusForLongshots = 0;
  const favorites = sortedByOdds.slice(0, 3);
  const longshots = sortedByOdds.slice(-3);

  for (const fav of favorites) {
    for (const cat of bonusCategoryNames) {
      totalBonusForFavorites += fav.categoryScores[cat]?.score ?? 0;
    }
  }

  for (const ls of longshots) {
    for (const cat of bonusCategoryNames) {
      totalBonusForLongshots += ls.categoryScores[cat]?.score ?? 0;
    }
  }

  const avgBonusFavorites = totalBonusForFavorites / favorites.length;
  const avgBonusLongshots = totalBonusForLongshots / longshots.length;

  if (avgBonusLongshots > avgBonusFavorites * 1.5) {
    systematicIssues.push(
      `Bonus categories favor longshots: avg ${avgBonusLongshots.toFixed(1)} pts vs favorites ${avgBonusFavorites.toFixed(1)} pts`
    );
  }

  // High disagreement count
  const highDisagreementCount = diagnostics.filter(
    (d) => d.disagreementLevel === 'high' || d.disagreementLevel === 'extreme'
  ).length;

  if (highDisagreementCount > fieldSize * 0.5) {
    systematicIssues.push(
      `High disagreement with market for ${highDisagreementCount}/${fieldSize} horses`
    );
  }

  // Weight distribution analysis
  const weightAnalysis = analyzeWeightDistribution();

  // Add weight issues to systematic issues
  for (const wa of weightAnalysis) {
    if (wa.recommendation) {
      systematicIssues.push(`Weight issue: ${wa.category} - ${wa.recommendation}`);
    }
  }

  return {
    horses: diagnostics,
    systematicIssues,
    weightAnalysis,
    summary: {
      totalHorses: fieldSize,
      highDisagreementCount,
      avgFavoriteRank,
      favoritesInTop3,
    },
  };
}

/**
 * Format diagnostic output for console
 */
export function formatDiagnosticOutput(diagnostic: HorseDiagnostic): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('='.repeat(70));
  lines.push(
    `HORSE: ${diagnostic.horseName} (#${diagnostic.programNumber}) - ML: ${diagnostic.morningLineOdds}`
  );
  lines.push('='.repeat(70));
  lines.push('');

  // Scores summary
  lines.push('SCORES:');
  lines.push(`  Base Score: ${diagnostic.baseScore}`);
  lines.push(`  Total Score: ${diagnostic.totalScore}`);
  lines.push('');

  // Probability comparison
  lines.push('MARKET VS MODEL:');
  lines.push(`  Market Implied Win Prob: ${diagnostic.marketImpliedWinProb.toFixed(1)}%`);
  lines.push(`  Model Implied Win Prob:  ${diagnostic.modelImpliedWinProb.toFixed(1)}%`);
  lines.push(
    `  Disagreement: ${diagnostic.disagreementPercent > 0 ? '+' : ''}${diagnostic.disagreementPercent.toFixed(1)}% (${diagnostic.disagreementLevel.toUpperCase()})`
  );
  lines.push('');

  // Category breakdown
  lines.push('CATEGORY BREAKDOWN:');
  const categories = Object.entries(diagnostic.categoryScores).sort((a, b) => b[1].max - a[1].max);

  for (const [name, data] of categories) {
    const bar = '█'.repeat(Math.round(data.percent / 5));
    const emptyBar = '░'.repeat(20 - bar.length);
    lines.push(
      `  ${name.padEnd(22)} ${String(data.score).padStart(3)}/${String(data.max).padStart(3)} (${data.percent.toFixed(0).padStart(3)}%) ${bar}${emptyBar}`
    );
    if (data.issues.length > 0) {
      for (const issue of data.issues) {
        lines.push(`    ⚠ ${issue}`);
      }
    }
  }
  lines.push('');

  // Weak/Strong categories
  if (diagnostic.weakestCategories.length > 0) {
    lines.push(`WEAK CATEGORIES (<50%): ${diagnostic.weakestCategories.join(', ')}`);
  }
  if (diagnostic.strongestCategories.length > 0) {
    lines.push(`STRONG CATEGORIES (>75%): ${diagnostic.strongestCategories.join(', ')}`);
  }
  lines.push('');

  // Issues
  if (diagnostic.potentialIssues.length > 0) {
    lines.push('POTENTIAL ISSUES:');
    for (const issue of diagnostic.potentialIssues) {
      lines.push(`  • ${issue}`);
    }
    lines.push('');
  }

  // Favorite flags
  if (diagnostic.favoriteFlags.length > 0) {
    lines.push('FAVORITE FLAGS (why this favorite may rank low):');
    for (const flag of diagnostic.favoriteFlags) {
      lines.push(`  🚩 ${flag}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format field diagnostic output for console
 */
export function formatFieldDiagnosticOutput(fieldDiag: FieldDiagnostic): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('#'.repeat(80));
  lines.push('SCORING ENGINE DIAGNOSTIC REPORT');
  lines.push('#'.repeat(80));
  lines.push('');

  // Summary
  lines.push('SUMMARY:');
  lines.push(`  Total Horses: ${fieldDiag.summary.totalHorses}`);
  lines.push(`  High Disagreement: ${fieldDiag.summary.highDisagreementCount}`);
  lines.push(`  Avg Favorite Rank: ${fieldDiag.summary.avgFavoriteRank.toFixed(1)}`);
  lines.push(`  Favorites in Top 3: ${fieldDiag.summary.favoritesInTop3}`);
  lines.push('');

  // Weight distribution
  lines.push(getWeightDistributionTable());

  // Systematic issues
  if (fieldDiag.systematicIssues.length > 0) {
    lines.push('SYSTEMATIC ISSUES DETECTED:');
    lines.push('-'.repeat(40));
    for (const issue of fieldDiag.systematicIssues) {
      lines.push(`  ❌ ${issue}`);
    }
    lines.push('');
  }

  // Individual horse diagnostics
  for (const horse of fieldDiag.horses) {
    lines.push(formatDiagnosticOutput(horse));
  }

  return lines.join('\n');
}

/**
 * Get a concise summary of identified issues
 */
export function getSummaryIssues(): string[] {
  return [
    // Core issues identified through analysis
    'ISSUE 1: Bonus categories (59 pts / 19%) favor horses with situational triggers',
    '  - Distance/Surface (20 pts): 0 pts if unproven at distance/surface',
    '  - Trainer Patterns (15 pts): Requires 5+ starts in pattern',
    '  - Combo Patterns (12 pts): Favors class droppers with equipment changes',
    '  - Track Specialist (6 pts): Requires 4+ starts at track',
    '  - Trainer Surface/Distance (6 pts): Pattern-based bonus',
    '',
    'ISSUE 2: Missing data treated as penalty instead of neutral',
    '  - 0 turf starts = 0 pts (not neutral)',
    '  - 0 track starts = 0 pts (not neutral)',
    '  - New trainer at meet = neutral instead of evaluating actual stats',
    '',
    'ISSUE 3: Combo patterns favor longshots over favorites',
    '  - Class drop + equipment = 4-6 pts bonus',
    '  - Favorites racing at level get no combo bonus',
    '  - Results in ~12 pt swing favoring longshots',
    '',
    'ISSUE 4: Form scoring may underweight recent wins',
    '  - Weighted average across 3 races can dilute a win',
    '  - Horse that won last race should score near max',
    '',
    'ISSUE 5: Connections scoring punishes new-to-meet connections',
    '  - <3 meet starts = neutral (not top tier)',
    '  - Favors established local connections over quality shippers',
    '',
    'ROOT CAUSE HYPOTHESIS:',
    '  Favorites rank low because they often:',
    '  1. Race at appropriate level (no class drop combo bonus)',
    '  2. Have stable equipment (no equipment change bonus)',
    '  3. Ship to new track (no track specialist bonus)',
    '  4. Have new-to-meet connections (neutral instead of high)',
    '  5. Are first-time on surface (0 instead of neutral)',
    '',
    '  Meanwhile, longshots may get:',
    '  + Class drop bonuses',
    '  + Equipment change bonuses',
    '  + Local trainer/jockey bonuses',
    '  + Track specialist bonuses',
    '  = Up to 50+ point advantage from situational bonuses',
  ];
}
