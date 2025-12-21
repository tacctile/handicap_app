/**
 * Breeding Scoring Module
 *
 * Calculates breeding-based scores for lightly raced horses.
 * Only applies to horses with <8 starts where past performance data is limited.
 *
 * Total: 0-60 points (can boost a lightly raced horse significantly)
 *
 * Score breakdown:
 * - Sire score: 0-25 points
 * - Dam score: 0-20 points (default 5 if unknown)
 * - Damsire score: 0-15 points (default 5 if unknown)
 * - Bonuses:
 *   - Elite sire debut bonus: +10 points (for first-time starters from elite sires)
 *   - Surface fit bonus: +5 points (turf breeding on turf, etc.)
 *   - Distance fit bonus: +5 points (sprint breeding in sprints, etc.)
 *
 * Total max: ~60 points (theoretical max with all bonuses)
 */

import type { HorseEntry, RaceHeader } from '../../types/drf';
import type { BreedingScore, BreedingScoreBreakdown, BreedingConfidence } from './types';
import { extractBreedingInfo } from './breedingExtractor';
import {
  calculateSireScore,
  lookupSire,
  getSireTierLabel,
  getSireTierColor,
  type ExtendedSireProfile,
} from './sireDatabase';
import {
  calculateDamScore,
  lookupDam,
  getDamTierLabel,
  type ExtendedDamProfile,
} from './damDatabase';
import {
  calculateDamsireScore,
  lookupDamsire,
  getDamsireTierLabel,
  type ExtendedDamsireProfile,
} from './damsireDatabase';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum starts for breeding analysis to apply */
export const MAX_STARTS_FOR_BREEDING = 7;

/** Score limits for breeding categories */
export const BREEDING_CATEGORY_LIMITS = {
  sire: 25,
  dam: 20,
  damsire: 15,
  bonuses: {
    eliteSireDebut: 10,
    surfaceFit: 5,
    distanceFit: 5,
  },
  total: 60,
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface BreedingScoreContext {
  surface: string;
  distance: string;
  distanceCategory: 'sprint' | 'route' | 'versatile';
  isDebut: boolean;
  starts: number;
}

export interface DetailedBreedingScore extends BreedingScore {
  /** Detailed sire scoring info */
  sireDetails: {
    score: number;
    profile: ExtendedSireProfile | null;
    tierLabel: string;
    tierColor: string;
    reasoning: string;
  };
  /** Detailed dam scoring info */
  damDetails: {
    score: number;
    profile: ExtendedDamProfile | null;
    tierLabel: string | null;
    reasoning: string;
  };
  /** Detailed damsire scoring info */
  damsireDetails: {
    score: number;
    profile: ExtendedDamsireProfile | null;
    tierLabel: string | null;
    reasoning: string;
  };
  /** Bonus scoring info */
  bonuses: {
    eliteSireDebut: number;
    surfaceFit: number;
    distanceFit: number;
    total: number;
    reasons: string[];
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse distance string to determine category
 */
function parseDistanceCategory(distance: string): 'sprint' | 'route' | 'versatile' {
  const distLower = distance.toLowerCase();

  // Handle mile distances
  if (distLower.includes('m')) {
    const mileMatch = distLower.match(/(\d+\.?\d*)\s*m/);
    if (mileMatch && mileMatch[1]) {
      const miles = parseFloat(mileMatch[1]);
      const furlongs = miles * 8;
      if (furlongs >= 9) return 'route';
      if (furlongs <= 7) return 'sprint';
      return 'versatile';
    }
  }

  // Handle furlong distances
  const furlongMatch = distLower.match(/(\d+\.?\d*)\s*f/);
  if (furlongMatch && furlongMatch[1]) {
    const furlongs = parseFloat(furlongMatch[1]);
    if (furlongs <= 7) return 'sprint';
    if (furlongs >= 9) return 'route';
    return 'versatile';
  }

  return 'versatile';
}

/**
 * Determine confidence level based on available data
 */
function determineConfidence(
  sireProfile: ExtendedSireProfile | null,
  damProfile: ExtendedDamProfile | null,
  damsireProfile: ExtendedDamsireProfile | null
): BreedingConfidence {
  const knownCount = [sireProfile, damProfile, damsireProfile].filter((p) => p !== null).length;

  if (knownCount === 3) return 'high';
  if (knownCount >= 2) return 'medium';
  if (knownCount === 1) return 'low';
  return 'none';
}

/**
 * Generate summary text for breeding score
 */
function generateSummary(
  score: number,
  sireProfile: ExtendedSireProfile | null,
  isDebut: boolean,
  starts: number
): string {
  if (starts >= 8) {
    return 'Breeding analysis not applied (8+ starts - experience data prioritized)';
  }

  if (score >= 50) {
    if (isDebut && sireProfile?.tier === 'elite') {
      return `Elite breeding profile: ${sireProfile.name} debut runner with top pedigree support`;
    }
    return 'Exceptional breeding profile - strong from all angles';
  }

  if (score >= 40) {
    if (sireProfile) {
      return `Strong breeding: ${sireProfile.name} progeny with solid pedigree`;
    }
    return 'Strong breeding profile with good pedigree support';
  }

  if (score >= 30) {
    return 'Above average breeding - positive pedigree factors';
  }

  if (score >= 20) {
    return 'Average breeding profile - standard expectations';
  }

  if (score >= 10) {
    return 'Below average breeding profile';
  }

  return 'Limited breeding data available';
}

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Calculate breeding score for a horse
 *
 * @param horse - The horse entry
 * @param raceHeader - Race header for context
 * @returns Detailed breeding score
 */
export function calculateDetailedBreedingScore(
  horse: HorseEntry,
  raceHeader: RaceHeader
): DetailedBreedingScore {
  const breedingInfo = extractBreedingInfo(horse);
  const starts = breedingInfo.lifetimeStarts;

  // Build context
  const context: BreedingScoreContext = {
    surface: raceHeader.surface,
    distance: raceHeader.distance,
    distanceCategory: parseDistanceCategory(raceHeader.distance),
    isDebut: starts === 0,
    starts,
  };

  // Check if breeding analysis should apply
  if (starts >= 8) {
    return createNotApplicableScore(
      'Horse has 8+ starts - experience data prioritized over breeding'
    );
  }

  // Calculate sire score
  const sireResult = calculateSireScore(breedingInfo.sire, {
    surface: context.surface,
    distanceCategory: context.distanceCategory,
    isDebut: context.isDebut,
  });
  const sireProfile = lookupSire(breedingInfo.sire);

  // Calculate dam score
  const damResult = calculateDamScore(breedingInfo.dam);
  const damProfile = lookupDam(breedingInfo.dam);

  // Calculate damsire score
  const damsireResult = calculateDamsireScore(breedingInfo.damsire, {
    surface: context.surface,
    isRoute: context.distanceCategory === 'route',
  });
  const damsireProfile = lookupDamsire(breedingInfo.damsire);

  // Calculate bonuses
  const bonuses = calculateBonuses(sireProfile, damsireProfile, context);

  // Calculate total score (capped at 60)
  const rawTotal = sireResult.score + damResult.score + damsireResult.score + bonuses.total;
  const total = Math.min(BREEDING_CATEGORY_LIMITS.total, rawTotal);

  // Build breakdown (using the types from breeding/types.ts which caps dam at 15 and damsire at 10)
  // But we'll use our actual calculated scores
  const breakdown: BreedingScoreBreakdown = {
    sireScore: sireResult.score,
    damScore: damResult.score,
    damsireScore: damsireResult.score,
    fitScore: bonuses.total,
  };

  // Determine confidence
  const confidence = determineConfidence(sireProfile, damProfile, damsireProfile);

  // Generate summary
  const summary = generateSummary(total, sireProfile, context.isDebut, context.starts);

  return {
    total,
    breakdown,
    confidence,
    summary,
    wasApplied: true,
    sireDetails: {
      score: sireResult.score,
      profile: sireProfile,
      tierLabel: sireProfile ? getSireTierLabel(sireProfile.tier) : 'Unknown',
      tierColor: sireProfile ? getSireTierColor(sireProfile.tier) : '#888888',
      reasoning: sireResult.reasoning,
    },
    damDetails: {
      score: damResult.score,
      profile: damProfile,
      tierLabel: damProfile ? getDamTierLabel(damProfile.tier) : null,
      reasoning: damResult.reasoning,
    },
    damsireDetails: {
      score: damsireResult.score,
      profile: damsireProfile,
      tierLabel: damsireProfile ? getDamsireTierLabel(damsireProfile.tier) : null,
      reasoning: damsireResult.reasoning,
    },
    bonuses,
  };
}

/**
 * Calculate bonuses based on context
 */
function calculateBonuses(
  sireProfile: ExtendedSireProfile | null,
  damsireProfile: ExtendedDamsireProfile | null,
  context: BreedingScoreContext
): {
  eliteSireDebut: number;
  surfaceFit: number;
  distanceFit: number;
  total: number;
  reasons: string[];
} {
  const bonuses = {
    eliteSireDebut: 0,
    surfaceFit: 0,
    distanceFit: 0,
    total: 0,
    reasons: [] as string[],
  };

  // Elite sire debut bonus (+10)
  if (context.isDebut && sireProfile?.tier === 'elite') {
    bonuses.eliteSireDebut = 10;
    bonuses.reasons.push(`+10 elite sire debut (${sireProfile.name} first-time starter)`);
  }

  // Surface fit bonus (+5)
  const surfaceLower = context.surface.toLowerCase();
  if (sireProfile) {
    const sireSurface = sireProfile.surfacePreference;
    if (
      (surfaceLower === 'turf' && sireSurface === 'turf') ||
      (surfaceLower === 'dirt' && sireSurface === 'dirt')
    ) {
      bonuses.surfaceFit = 5;
      bonuses.reasons.push(
        `+5 surface fit (${sireProfile.name} ${sireSurface} specialist on ${surfaceLower})`
      );
    }
  } else if (damsireProfile) {
    const damsireSurface = damsireProfile.surfaceInfluence;
    if (
      (surfaceLower === 'turf' && damsireSurface === 'turf') ||
      (surfaceLower === 'dirt' && damsireSurface === 'dirt')
    ) {
      bonuses.surfaceFit = 3;
      bonuses.reasons.push(`+3 damsire surface influence`);
    }
  }

  // Distance fit bonus (+5)
  if (sireProfile && sireProfile.distancePreference.category !== 'versatile') {
    if (sireProfile.distancePreference.category === context.distanceCategory) {
      bonuses.distanceFit = 5;
      bonuses.reasons.push(
        `+5 distance fit (${sireProfile.name} ${context.distanceCategory} specialist)`
      );
    }
  }

  bonuses.total = bonuses.eliteSireDebut + bonuses.surfaceFit + bonuses.distanceFit;

  return bonuses;
}

/**
 * Create a not-applicable breeding score
 */
function createNotApplicableScore(reason: string): DetailedBreedingScore {
  return {
    total: 0,
    breakdown: {
      sireScore: 0,
      damScore: 0,
      damsireScore: 0,
      fitScore: 0,
    },
    confidence: 'none',
    summary: 'Breeding analysis not applicable',
    wasApplied: false,
    notAppliedReason: reason,
    sireDetails: {
      score: 0,
      profile: null,
      tierLabel: 'N/A',
      tierColor: '#888888',
      reasoning: reason,
    },
    damDetails: {
      score: 0,
      profile: null,
      tierLabel: null,
      reasoning: reason,
    },
    damsireDetails: {
      score: 0,
      profile: null,
      tierLabel: null,
      reasoning: reason,
    },
    bonuses: {
      eliteSireDebut: 0,
      surfaceFit: 0,
      distanceFit: 0,
      total: 0,
      reasons: [],
    },
  };
}

// ============================================================================
// SIMPLIFIED SCORING FUNCTION
// ============================================================================

/**
 * Calculate breeding score (simplified version for integration)
 *
 * @param horse - The horse entry
 * @param raceHeader - Race header for context
 * @returns Standard BreedingScore
 */
export function calculateBreedingScoreForHorse(
  horse: HorseEntry,
  raceHeader: RaceHeader
): BreedingScore {
  const detailed = calculateDetailedBreedingScore(horse, raceHeader);

  return {
    total: detailed.total,
    breakdown: detailed.breakdown,
    confidence: detailed.confidence,
    summary: detailed.summary,
    wasApplied: detailed.wasApplied,
    notAppliedReason: detailed.notAppliedReason,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if breeding analysis should be shown for a horse
 */
export function shouldShowBreedingAnalysis(horse: HorseEntry): boolean {
  const starts = horse.lifetimeStarts ?? 0;
  return starts < 8;
}

/**
 * Get breeding score weight based on starts
 * More weight for debut/fewer starts, less weight as experience increases
 */
export function getBreedingScoreWeight(starts: number): number {
  if (starts === 0) return 1.0; // Full weight for debuts
  if (starts === 1) return 0.9; // 90% weight
  if (starts === 2) return 0.8; // 80% weight
  if (starts === 3) return 0.7; // 70% weight
  if (starts === 4) return 0.6; // 60% weight
  if (starts === 5) return 0.5; // 50% weight
  if (starts === 6) return 0.4; // 40% weight
  if (starts === 7) return 0.3; // 30% weight
  return 0; // No weight for 8+ starts
}

/**
 * Calculate weighted breeding contribution to overall score
 */
export function calculateBreedingContribution(
  breedingScore: BreedingScore,
  starts: number
): number {
  if (!breedingScore.wasApplied) return 0;

  const weight = getBreedingScoreWeight(starts);
  return Math.round(breedingScore.total * weight);
}

/**
 * Get display info for breeding section
 */
export function getBreedingScoreDisplay(score: DetailedBreedingScore): {
  label: string;
  color: string;
  description: string;
} {
  if (!score.wasApplied) {
    return {
      label: 'N/A',
      color: '#888888',
      description: score.notAppliedReason || 'Not applicable',
    };
  }

  if (score.total >= 50) {
    return {
      label: 'Elite',
      color: '#22c55e',
      description: 'Exceptional breeding profile',
    };
  }

  if (score.total >= 40) {
    return {
      label: 'Strong',
      color: '#36d1da',
      description: 'Strong breeding profile',
    };
  }

  if (score.total >= 30) {
    return {
      label: 'Above Avg',
      color: '#19abb5',
      description: 'Above average breeding',
    };
  }

  if (score.total >= 20) {
    return {
      label: 'Average',
      color: '#888888',
      description: 'Average breeding profile',
    };
  }

  return {
    label: 'Below Avg',
    color: '#ef4444',
    description: 'Limited breeding support',
  };
}
