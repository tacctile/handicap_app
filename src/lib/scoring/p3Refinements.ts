/**
 * P3 Final Refinements Module
 *
 * Three minor enhancements for 100% utilization of usable DRF data:
 * 1. Earnings-based class indicator (informational, no new points)
 * 2. Sire's sire analysis (±1 pt max to breeding)
 * 3. Age-based peak performance (±1 pt max)
 *
 * Total new scoring potential: ±2 points max (very subtle refinements)
 */

import type { HorseEntry, RaceHeader, Surface } from '../../types/drf';

// ============================================================================
// PART 1: EARNINGS-BASED CLASS REFINEMENT
// ============================================================================

export type EarningsClass = 'elite' | 'strong' | 'average' | 'low';

export interface EarningsClassIndicator {
  /** Lifetime earnings in dollars */
  lifetimeEarnings: number;
  /** Average earnings per start */
  avgEarningsPerStart: number;
  /** Current year earnings */
  currentYearEarnings: number;
  /** Earnings class tier */
  earningsClass: EarningsClass;
  /** Reasoning for display */
  reasoning: string;
}

/**
 * Get earnings-based class indicator for a horse
 *
 * Thresholds (average earnings per start):
 * - $50k+: elite
 * - $20k-50k: strong
 * - $5k-20k: average
 * - <$5k: low
 *
 * @param horse - The horse entry
 * @returns Earnings class indicator (informational, no new points)
 */
export function getEarningsClassIndicator(horse: HorseEntry): EarningsClassIndicator {
  const lifetimeEarnings = horse.lifetimeEarnings ?? 0;
  const lifetimeStarts = horse.lifetimeStarts ?? 0;
  const currentYearEarnings = horse.currentYearEarnings ?? 0;

  // Calculate average earnings per start
  const avgEarningsPerStart = lifetimeStarts > 0 ? lifetimeEarnings / lifetimeStarts : 0;

  // Determine earnings class tier
  let earningsClass: EarningsClass;
  let reasoning: string;

  if (avgEarningsPerStart >= 50000) {
    earningsClass = 'elite';
    reasoning = `Elite earner: $${formatEarnings(avgEarningsPerStart)} avg/start from ${lifetimeStarts} starts`;
  } else if (avgEarningsPerStart >= 20000) {
    earningsClass = 'strong';
    reasoning = `Strong earner: $${formatEarnings(avgEarningsPerStart)} avg/start from ${lifetimeStarts} starts`;
  } else if (avgEarningsPerStart >= 5000) {
    earningsClass = 'average';
    reasoning = `Average earner: $${formatEarnings(avgEarningsPerStart)} avg/start from ${lifetimeStarts} starts`;
  } else {
    earningsClass = 'low';
    if (lifetimeStarts === 0) {
      reasoning = 'First-time starter: no earnings data';
    } else {
      reasoning = `Low earner: $${formatEarnings(avgEarningsPerStart)} avg/start from ${lifetimeStarts} starts`;
    }
  }

  return {
    lifetimeEarnings,
    avgEarningsPerStart,
    currentYearEarnings,
    earningsClass,
    reasoning,
  };
}

/**
 * Format earnings value for display
 */
function formatEarnings(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(2)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toFixed(0);
}

/**
 * Get earnings class color for display
 */
export function getEarningsClassColor(earningsClass: EarningsClass): string {
  switch (earningsClass) {
    case 'elite':
      return '#22c55e'; // Green
    case 'strong':
      return '#36d1da'; // Teal
    case 'average':
      return '#888888'; // Gray
    case 'low':
      return '#ef4444'; // Red
  }
}

// ============================================================================
// PART 2: SIRE'S SIRE ANALYSIS
// ============================================================================

export interface SiresSireAnalysis {
  /** Whether sire's sire is in the known influential list */
  known: boolean;
  /** Sire's sire name */
  siresSireName: string;
  /** Surface affinity (-1 to +1) */
  surfaceAffinity: number;
  /** Distance affinity (-1 to +1) */
  distanceAffinity: number;
  /** Points adjustment (±1 max) */
  adjustment: number;
  /** Reasoning for display */
  reasoning: string;
}

/**
 * Known influential sires (commonly seen as sire's sire)
 * These are sires whose influence as paternal grandsire is significant
 */
const INFLUENTIAL_SIRES_SIRES: Record<
  string,
  {
    surfacePreference: 'dirt' | 'turf' | 'versatile';
    distancePreference: 'sprint' | 'route' | 'versatile';
    influence: 'strong' | 'moderate';
  }
> = {
  // Elite dirt sires - strong stamina influence as grandsires
  'A.P. INDY': { surfacePreference: 'dirt', distancePreference: 'route', influence: 'strong' },
  'STORM CAT': {
    surfacePreference: 'versatile',
    distancePreference: 'sprint',
    influence: 'strong',
  },
  'MR. PROSPECTOR': {
    surfacePreference: 'dirt',
    distancePreference: 'versatile',
    influence: 'strong',
  },
  'SMART STRIKE': { surfacePreference: 'dirt', distancePreference: 'route', influence: 'strong' },
  UNBRIDLED: { surfacePreference: 'dirt', distancePreference: 'route', influence: 'strong' },
  "GIANT'S CAUSEWAY": {
    surfacePreference: 'versatile',
    distancePreference: 'versatile',
    influence: 'strong',
  },

  // Elite turf sires - strong turf influence as grandsires
  GALILEO: { surfacePreference: 'turf', distancePreference: 'route', influence: 'strong' },
  "SADLER'S WELLS": { surfacePreference: 'turf', distancePreference: 'route', influence: 'strong' },
  DANEHILL: { surfacePreference: 'turf', distancePreference: 'versatile', influence: 'strong' },
  'EL PRADO': { surfacePreference: 'turf', distancePreference: 'route', influence: 'strong' },

  // Modern influential sires
  'INTO MISCHIEF': {
    surfacePreference: 'dirt',
    distancePreference: 'versatile',
    influence: 'strong',
  },
  CURLIN: { surfacePreference: 'dirt', distancePreference: 'route', influence: 'strong' },
  TAPIT: { surfacePreference: 'dirt', distancePreference: 'versatile', influence: 'strong' },
  'UNCLE MO': { surfacePreference: 'dirt', distancePreference: 'sprint', influence: 'strong' },
  'WAR FRONT': { surfacePreference: 'turf', distancePreference: 'sprint', influence: 'strong' },
  SPEIGHTSTOWN: { surfacePreference: 'dirt', distancePreference: 'sprint', influence: 'strong' },

  // Moderate influence - still notable but less consistent
  'CANDY RIDE': {
    surfacePreference: 'dirt',
    distancePreference: 'route',
    influence: 'moderate',
  },
  'STREET CRY': {
    surfacePreference: 'versatile',
    distancePreference: 'route',
    influence: 'moderate',
  },
  'DISTORTED HUMOR': {
    surfacePreference: 'dirt',
    distancePreference: 'versatile',
    influence: 'moderate',
  },
  "MEDAGLIA D'ORO": {
    surfacePreference: 'versatile',
    distancePreference: 'route',
    influence: 'moderate',
  },
  'QUALITY ROAD': {
    surfacePreference: 'dirt',
    distancePreference: 'versatile',
    influence: 'moderate',
  },
  "KITTEN'S JOY": {
    surfacePreference: 'turf',
    distancePreference: 'route',
    influence: 'moderate',
  },
  'MORE THAN READY': {
    surfacePreference: 'versatile',
    distancePreference: 'sprint',
    influence: 'moderate',
  },
  GHOSTZAPPER: { surfacePreference: 'dirt', distancePreference: 'route', influence: 'moderate' },
  'MALIBU MOON': {
    surfacePreference: 'dirt',
    distancePreference: 'versatile',
    influence: 'moderate',
  },
};

/**
 * Normalize sire name for lookup
 */
function normalizeSireName(name: string): string {
  return name.toUpperCase().trim().replace(/['']/g, "'").replace(/\s+/g, ' ');
}

/**
 * Check if distance is sprint (<= 7f) or route (> 7f)
 */
function isSprintDistance(distanceFurlongs: number): boolean {
  return distanceFurlongs <= 7;
}

/**
 * Analyze sire's sire influence on breeding
 *
 * @param siresSire - The sire's sire name (paternal grandsire)
 * @param surface - Current race surface
 * @param distanceFurlongs - Current race distance in furlongs
 * @returns Sire's sire analysis with adjustment (±1 max)
 */
export function analyzeSiresSire(
  siresSire: string,
  surface: Surface,
  distanceFurlongs: number
): SiresSireAnalysis {
  const normalized = normalizeSireName(siresSire);
  const profile = INFLUENTIAL_SIRES_SIRES[normalized];

  if (!profile) {
    return {
      known: false,
      siresSireName: siresSire,
      surfaceAffinity: 0,
      distanceAffinity: 0,
      adjustment: 0,
      reasoning: `Unknown sire's sire "${siresSire}" - no adjustment`,
    };
  }

  // Calculate surface affinity (-1 to +1)
  let surfaceAffinity = 0;
  const surfaceLower = surface.toLowerCase();
  if (profile.surfacePreference !== 'versatile') {
    if (
      (surfaceLower === 'turf' && profile.surfacePreference === 'turf') ||
      (surfaceLower === 'dirt' && profile.surfacePreference === 'dirt')
    ) {
      surfaceAffinity = profile.influence === 'strong' ? 1 : 0.5;
    } else if (
      (surfaceLower === 'turf' && profile.surfacePreference === 'dirt') ||
      (surfaceLower === 'dirt' && profile.surfacePreference === 'turf')
    ) {
      surfaceAffinity = profile.influence === 'strong' ? -0.5 : -0.25;
    }
  }

  // Calculate distance affinity (-1 to +1)
  let distanceAffinity = 0;
  const isSprint = isSprintDistance(distanceFurlongs);
  if (profile.distancePreference !== 'versatile') {
    if (
      (isSprint && profile.distancePreference === 'sprint') ||
      (!isSprint && profile.distancePreference === 'route')
    ) {
      distanceAffinity = profile.influence === 'strong' ? 1 : 0.5;
    } else if (
      (isSprint && profile.distancePreference === 'route') ||
      (!isSprint && profile.distancePreference === 'sprint')
    ) {
      distanceAffinity = profile.influence === 'strong' ? -0.5 : -0.25;
    }
  }

  // Calculate adjustment (±1 max)
  // Only apply positive adjustment if both surface and distance align
  // Subtle negative if clear mismatch
  const combinedAffinity = (surfaceAffinity + distanceAffinity) / 2;
  let adjustment = 0;

  if (combinedAffinity >= 0.75) {
    adjustment = 1; // Strong fit on both surface and distance
  } else if (combinedAffinity >= 0.25) {
    adjustment = 0; // Moderate fit, no adjustment needed
  } else if (combinedAffinity <= -0.5) {
    adjustment = -1; // Clear mismatch
  }

  // Build reasoning
  const reasons: string[] = [];
  reasons.push(`${siresSire} (${profile.influence} influence)`);

  if (surfaceAffinity > 0) {
    reasons.push(`+surface fit (${profile.surfacePreference})`);
  } else if (surfaceAffinity < 0) {
    reasons.push(`surface mismatch`);
  }

  if (distanceAffinity > 0) {
    reasons.push(`+distance fit (${profile.distancePreference})`);
  } else if (distanceAffinity < 0) {
    reasons.push(`distance mismatch`);
  }

  if (adjustment !== 0) {
    reasons.push(`${adjustment > 0 ? '+' : ''}${adjustment} pt adjustment`);
  }

  return {
    known: true,
    siresSireName: siresSire,
    surfaceAffinity,
    distanceAffinity,
    adjustment,
    reasoning: reasons.join(' | '),
  };
}

// ============================================================================
// PART 3: AGE-BASED PEAK PERFORMANCE
// ============================================================================

export type PeakStatus = 'developing' | 'peak' | 'mature' | 'declining';

export interface AgeFactorAnalysis {
  /** Horse's age */
  age: number;
  /** Peak status classification */
  peakStatus: PeakStatus;
  /** Points adjustment (-1 to +1) */
  adjustment: number;
  /** Reasoning for display */
  reasoning: string;
}

/**
 * Analyze age-based peak performance factor
 *
 * Age guidelines:
 * - 2yo: developing (0 pts, too variable)
 * - 3yo: peak for classics (0 pts baseline)
 * - 4-5yo: prime years (+1 pt subtle boost)
 * - 6-7yo: mature (0 pts)
 * - 8+yo: potentially declining (-1 pt flag, especially on turf)
 *
 * Note: Turf horses tend to peak later, dirt sprinters earlier
 *
 * @param age - Horse's age in years
 * @param surface - Current race surface
 * @returns Age factor analysis with adjustment (±1 max)
 */
export function analyzeAgeFactor(age: number, surface: Surface): AgeFactorAnalysis {
  const surfaceLower = surface.toLowerCase();
  const isTurf = surfaceLower === 'turf';

  let peakStatus: PeakStatus;
  let adjustment = 0;
  let reasoning: string;

  if (age <= 2) {
    // 2-year-olds: developing, too variable
    peakStatus = 'developing';
    adjustment = 0;
    reasoning = '2yo: developing, no adjustment (too variable)';
  } else if (age === 3) {
    // 3-year-olds: classic age, baseline
    peakStatus = 'peak';
    adjustment = 0;
    reasoning = '3yo: classic year, baseline (no adjustment)';
  } else if (age === 4 || age === 5) {
    // 4-5yo: prime racing years
    peakStatus = 'peak';
    adjustment = 1;
    reasoning = `${age}yo: prime years (+1 pt subtle boost)`;
  } else if (age === 6 || age === 7) {
    // 6-7yo: mature, still competitive
    peakStatus = 'mature';
    // Turf horses can still be in peak form at 6-7
    if (isTurf) {
      adjustment = 0;
      reasoning = `${age}yo on turf: mature but still competitive (no adjustment)`;
    } else {
      adjustment = 0;
      reasoning = `${age}yo: mature (no adjustment)`;
    }
  } else {
    // 8+yo: potentially declining
    peakStatus = 'declining';
    // Turf horses especially concerning at 8+
    if (isTurf) {
      adjustment = -1;
      reasoning = `${age}yo on turf: declining (-1 pt flag, turf stamina concerns)`;
    } else {
      adjustment = -1;
      reasoning = `${age}yo: declining (-1 pt flag)`;
    }
  }

  return {
    age,
    peakStatus,
    adjustment,
    reasoning,
  };
}

/**
 * Get peak status display color
 */
export function getPeakStatusColor(status: PeakStatus): string {
  switch (status) {
    case 'developing':
      return '#3b82f6'; // Blue
    case 'peak':
      return '#22c55e'; // Green
    case 'mature':
      return '#888888'; // Gray
    case 'declining':
      return '#ef4444'; // Red
  }
}

/**
 * Get peak status display label
 */
export function getPeakStatusLabel(status: PeakStatus): string {
  switch (status) {
    case 'developing':
      return 'Developing';
    case 'peak':
      return 'Peak';
    case 'mature':
      return 'Mature';
    case 'declining':
      return 'Declining';
  }
}

// ============================================================================
// COMBINED P3 ANALYSIS
// ============================================================================

export interface P3RefinementsResult {
  /** Earnings class indicator (informational only) */
  earnings: EarningsClassIndicator;
  /** Sire's sire analysis (±1 pt to breeding) */
  siresSire: SiresSireAnalysis;
  /** Age factor analysis (±1 pt) */
  ageFactor: AgeFactorAnalysis;
  /** Total points adjustment from P3 (max ±2) */
  totalAdjustment: number;
  /** Combined reasoning */
  reasoning: string[];
}

/**
 * Calculate all P3 refinements for a horse
 *
 * @param horse - The horse entry
 * @param raceHeader - Race header for surface/distance context
 * @returns Complete P3 refinements analysis
 */
export function calculateP3Refinements(
  horse: HorseEntry,
  raceHeader: RaceHeader
): P3RefinementsResult {
  // Part 1: Earnings class indicator (informational only)
  const earnings = getEarningsClassIndicator(horse);

  // Part 2: Sire's sire analysis
  const siresSireName = horse.breeding?.sireOfSire ?? '';
  const siresSire = analyzeSiresSire(
    siresSireName,
    raceHeader.surface,
    raceHeader.distanceFurlongs
  );

  // Part 3: Age factor analysis
  const ageFactor = analyzeAgeFactor(horse.age, raceHeader.surface);

  // Calculate total adjustment (siresSire goes to breeding, ageFactor to base)
  // Note: siresSire adjustment is integrated into breeding score, not base
  const totalAdjustment = ageFactor.adjustment; // Only age factor adds to base score directly

  // Build combined reasoning
  const reasoning: string[] = [];

  // Add earnings reasoning (informational)
  if (earnings.earningsClass !== 'low' || horse.lifetimeStarts > 0) {
    reasoning.push(`Earnings: ${earnings.earningsClass}`);
  }

  // Add sire's sire reasoning if known
  if (siresSire.known && siresSire.adjustment !== 0) {
    reasoning.push(
      `Sire's sire: ${siresSire.adjustment > 0 ? '+' : ''}${siresSire.adjustment} breeding`
    );
  }

  // Add age factor reasoning if adjustment
  if (ageFactor.adjustment !== 0) {
    reasoning.push(
      `Age: ${ageFactor.adjustment > 0 ? '+' : ''}${ageFactor.adjustment} (${ageFactor.peakStatus})`
    );
  }

  return {
    earnings,
    siresSire,
    ageFactor,
    totalAdjustment,
    reasoning,
  };
}

// ============================================================================
// EXPORTS SUMMARY
// ============================================================================

export const P3_MAX_ADJUSTMENT = 2; // ±2 points maximum from all P3 refinements

// Export types and functions for integration
export type { EarningsClass as EarningsClassType, PeakStatus as PeakStatusType };
