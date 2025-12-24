/**
 * Track Speed Normalization Module
 *
 * Provides track-specific speed figure normalization to account for
 * the different quality levels between racetracks.
 *
 * Key Insight: A 90 Beyer at Saratoga is not the same as a 90 Beyer at Finger Lakes.
 * This module normalizes speed figures using:
 * 1. Track par times (from track intelligence data)
 * 2. Track tier adjustments (elite tracks vs regional circuits)
 *
 * The 4-Tier System for Speed Normalization:
 * - Tier 1 (Elite): Saratoga, Del Mar, Keeneland, Santa Anita, Belmont
 * - Tier 2 (Strong): Gulfstream, Churchill, Oaklawn, Aqueduct, Monmouth, Pimlico
 * - Tier 3 (Average): Most regional tracks (Laurel, Fair Grounds, Tampa Bay, etc.)
 * - Tier 4 (Weak): Smaller circuits (Finger Lakes, Fonner Park, etc.)
 */

import { getTrackData, trackDatabase } from '../../data/tracks';
import type { WinningTimeByDistance } from '../../data/tracks/trackSchema';
import type { RaceClassification } from '../../types/drf';

// ============================================================================
// TYPES
// ============================================================================

export type SpeedTier = 1 | 2 | 3 | 4;

export interface TrackSpeedInfo {
  trackCode: string;
  trackName: string;
  tier: SpeedTier;
  tierName: string;
  tierAdjustment: number;
}

export interface SpeedNormalizationResult {
  /** Original raw speed figure */
  rawFigure: number;
  /** Normalized speed figure (adjusted for track quality) */
  normalizedFigure: number;
  /** Par figure for this track/distance/class */
  parFigure: number | null;
  /** Track tier adjustment applied */
  tierAdjustment: number;
  /** Par comparison adjustment applied */
  parAdjustment: number;
  /** Total adjustment (tier + par) */
  totalAdjustment: number;
  /** Whether par data was available */
  hasParData: boolean;
  /** Reasoning string for display */
  reasoning: string;
}

export interface ShipperAnalysis {
  isShipping: boolean;
  fromTrack: string | null;
  fromTier: SpeedTier | null;
  toTrack: string;
  toTier: SpeedTier;
  tierChange: number; // Positive = shipping down (easier), negative = shipping up (harder)
  adjustment: number;
  reasoning: string;
}

// ============================================================================
// TIER DEFINITIONS
// ============================================================================

/**
 * Tier 1 (Elite): Premier tracks with highest quality racing
 * These tracks host major graded stakes and attract the best horses
 */
const TIER_1_TRACKS = new Set([
  'SAR', // Saratoga
  'DMR', // Del Mar
  'KEE', // Keeneland
  'SA', // Santa Anita
  'BEL', // Belmont Park
]);

/**
 * Tier 2 (Strong): Major racing circuits with quality fields
 * Key Derby prep tracks and prominent stakes venues
 */
const TIER_2_TRACKS = new Set([
  'GP', // Gulfstream Park
  'CD', // Churchill Downs
  'OP', // Oaklawn Park
  'AQU', // Aqueduct
  'MTH', // Monmouth Park
  'PIM', // Pimlico
]);

/**
 * Tier 3 (Average): Solid regional tracks with competitive racing
 * Most mid-level tracks default here
 */
const TIER_3_TRACKS = new Set([
  'LRL', // Laurel Park
  'FG', // Fair Grounds
  'TAM', // Tampa Bay Downs
  'WO', // Woodbine
  'PRX', // Parx Racing
  'PEN', // Penn National
  'DEL', // Delaware Park
  'IND', // Indiana Grand
  'LS', // Lone Star Park
  'RP', // Remington Park
  'CT', // Charles Town
  'EMD', // Emerald Downs
  'GG', // Golden Gate Fields
  'EVD', // Evangeline Downs
  'PRM', // Prairie Meadows
  'TUP', // Turf Paradise
  'HOU', // Sam Houston Race Park
  'TP', // Turfway Park
  'ELP', // Ellis Park
]);

/**
 * Tier 4 (Weak): Smaller circuits with lower-quality fields
 * Regional tracks with limited competition depth
 */
const TIER_4_TRACKS = new Set([
  'FL', // Finger Lakes
  'FON', // Fonner Park
  'BTP', // Belterra Park
  'SUN', // Sunland Park
  'DED', // Delta Downs
  'MNR', // Mountaineer
  'HOO', // Hoosier Park
  'CBY', // Canterbury Park
  'HST', // Hastings
  'LRC', // Los Alamitos (quarter horse focus)
]);

/**
 * Tier adjustment points for shipping between tiers
 * Applied when comparing figures from different tier tracks
 *
 * Positive adjustment = boost (running at easier track)
 * Negative adjustment = penalty (running at harder track)
 */
const TIER_ADJUSTMENTS: Record<SpeedTier, number> = {
  1: 5, // Tier 1 figures worth +5 points at neutral
  2: 2, // Tier 2 figures worth +2 points at neutral
  3: 0, // Tier 3 is baseline (neutral)
  4: -3, // Tier 4 figures penalized -3 points at neutral
};

/**
 * Display names for each tier
 */
const TIER_NAMES: Record<SpeedTier, string> = {
  1: 'Elite',
  2: 'Strong',
  3: 'Average',
  4: 'Weak',
};

// ============================================================================
// TIER LOOKUP FUNCTIONS
// ============================================================================

/**
 * Get the speed tier for a track
 */
export function getSpeedTier(trackCode: string): SpeedTier {
  const code = trackCode.toUpperCase();

  if (TIER_1_TRACKS.has(code)) return 1;
  if (TIER_2_TRACKS.has(code)) return 2;
  if (TIER_3_TRACKS.has(code)) return 3;
  if (TIER_4_TRACKS.has(code)) return 4;

  // Default unknown tracks to Tier 3 (average)
  // Check if we have track intelligence data to make a better guess
  const trackData = trackDatabase.get(code);
  if (trackData) {
    // If we have data for this track but it's not classified,
    // default to Tier 3 (average regional track)
    return 3;
  }

  // Unknown tracks default to Tier 3
  return 3;
}

/**
 * Get track tier adjustment points
 * Positive = figures worth more (elite tracks)
 * Negative = figures worth less (weak tracks)
 */
export function getTrackTierAdjustment(trackCode: string): number {
  const tier = getSpeedTier(trackCode);
  return TIER_ADJUSTMENTS[tier];
}

/**
 * Get comprehensive track speed info
 */
export function getTrackSpeedInfo(trackCode: string): TrackSpeedInfo {
  const code = trackCode.toUpperCase();
  const tier = getSpeedTier(code);
  const trackData = getTrackData(code);

  return {
    trackCode: code,
    trackName: trackData?.name ?? code,
    tier,
    tierName: TIER_NAMES[tier],
    tierAdjustment: TIER_ADJUSTMENTS[tier],
  };
}

/**
 * Check if a track is Tier 1 (elite)
 */
export function isTier1Track(trackCode: string): boolean {
  return getSpeedTier(trackCode) === 1;
}

/**
 * Check if a track is Tier 4 (weak)
 */
export function isTier4Track(trackCode: string): boolean {
  return getSpeedTier(trackCode) === 4;
}

// ============================================================================
// PAR TIME / SPEED PAR FUNCTIONS
// ============================================================================

/**
 * Map race classification to track data class level
 */
function mapClassificationToTrackClass(
  classification: RaceClassification
): 'claiming' | 'allowance' | 'stakes' {
  switch (classification) {
    case 'maiden-claiming':
    case 'claiming':
      return 'claiming';
    case 'maiden':
    case 'starter-allowance':
    case 'allowance':
    case 'allowance-optional-claiming':
      return 'allowance';
    case 'handicap':
    case 'stakes':
    case 'stakes-listed':
    case 'stakes-graded-3':
    case 'stakes-graded-2':
    case 'stakes-graded-1':
      return 'stakes';
    default:
      return 'allowance';
  }
}

/**
 * Get track speed par (Beyer equivalent) for a given track, distance, and class
 *
 * This converts winning time pars to approximate Beyer equivalents.
 * Uses the formula: Each 1 second faster than baseline = ~5 Beyer points
 *
 * @returns Estimated par Beyer figure or null if no data
 */
export function getTrackSpeedPar(
  trackCode: string,
  distanceFurlongs: number,
  classLevel: RaceClassification
): number | null {
  const trackData = getTrackData(trackCode);
  if (!trackData || trackData.winningTimes.length === 0) {
    return null;
  }

  // Find the closest distance match (within 0.5 furlongs)
  const winningTime = findClosestDistanceMatch(
    trackData.winningTimes,
    distanceFurlongs,
    'dirt' // Default to dirt for now
  );

  if (!winningTime) {
    return null;
  }

  // Map classification to track data class level
  const trackClass = mapClassificationToTrackClass(classLevel);

  // Get the average winning time for this class level
  let avgTime: number;
  switch (trackClass) {
    case 'claiming':
      avgTime = winningTime.claimingAvg;
      break;
    case 'allowance':
      avgTime = winningTime.allowanceAvg;
      break;
    case 'stakes':
      avgTime = winningTime.stakesAvg;
      break;
    default:
      avgTime = winningTime.allowanceAvg;
  }

  // Convert winning time to estimated Beyer figure
  // Base formula: 6f in 70s = ~75 Beyer (claiming level)
  // Each second faster = +5 Beyer points approximately

  // Baseline times (approximate claiming level for comparison)
  const baselineTimes: Record<number, number> = {
    5: 58.5, // 5f baseline
    5.5: 65.5, // 5.5f baseline
    6: 71.0, // 6f baseline
    6.5: 77.5, // 6.5f baseline
    7: 84.0, // 7f baseline
    8: 97.0, // 1 mile baseline
    8.5: 103.5, // 1 1/16m baseline
    9: 111.0, // 1 1/8m baseline
    10: 125.0, // 1 1/4m baseline
  };

  // Find closest baseline
  const distances = Object.keys(baselineTimes).map(Number);
  const closestDist = distances.reduce((prev, curr) =>
    Math.abs(curr - distanceFurlongs) < Math.abs(prev - distanceFurlongs) ? curr : prev
  );
  const baselineTime = baselineTimes[closestDist] ?? 71.0;
  const baseBeyer = 75; // Baseline Beyer at claiming level

  // Calculate estimated Beyer from winning time
  // Faster time = higher Beyer
  const timeDiff = baselineTime - avgTime;
  const estimatedBeyer = baseBeyer + Math.round(timeDiff * 5);

  // Apply tier adjustment
  const tierAdj = getTrackTierAdjustment(trackCode);
  const adjustedBeyer = estimatedBeyer + tierAdj;

  return Math.max(50, Math.min(120, adjustedBeyer)); // Clamp to reasonable range
}

/**
 * Find the closest distance match in winning times data
 */
function findClosestDistanceMatch(
  winningTimes: WinningTimeByDistance[],
  targetFurlongs: number,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): WinningTimeByDistance | null {
  const surfaceType = surface === 'turf' ? 'turf' : 'dirt';

  // Filter by surface and find closest distance
  const candidates = winningTimes.filter((wt) => wt.surface === surfaceType);

  if (candidates.length === 0) {
    // Fall back to any surface if no match
    return winningTimes.reduce(
      (closest, current) => {
        if (!closest) return current;
        return Math.abs(current.furlongs - targetFurlongs) <
          Math.abs(closest.furlongs - targetFurlongs)
          ? current
          : closest;
      },
      null as WinningTimeByDistance | null
    );
  }

  return candidates.reduce(
    (closest, current) => {
      if (!closest) return current;
      return Math.abs(current.furlongs - targetFurlongs) <
        Math.abs(closest.furlongs - targetFurlongs)
        ? current
        : closest;
    },
    null as WinningTimeByDistance | null
  );
}

// ============================================================================
// SPEED FIGURE NORMALIZATION
// ============================================================================

/**
 * Normalize a speed figure based on track quality
 *
 * This is the primary function for adjusting raw Beyer figures
 * to account for different track quality levels.
 *
 * @param rawFigure - The raw Beyer/speed figure
 * @param trackCode - The track where the figure was earned
 * @param distanceFurlongs - The distance in furlongs
 * @param classLevel - The class level of the race (optional)
 * @returns Normalized figure with adjustment details
 */
export function normalizeSpeedFigure(
  rawFigure: number,
  trackCode: string,
  distanceFurlongs: number,
  classLevel?: RaceClassification
): SpeedNormalizationResult {
  const tierAdj = getTrackTierAdjustment(trackCode);
  const tier = getSpeedTier(trackCode);
  const tierName = TIER_NAMES[tier];

  // Get par figure if class level provided
  let parFigure: number | null = null;
  let parAdjustment = 0;
  let hasParData = false;

  if (classLevel) {
    parFigure = getTrackSpeedPar(trackCode, distanceFurlongs, classLevel);
    if (parFigure !== null) {
      hasParData = true;
      // Calculate par-based adjustment
      // Above par = positive adjustment, below par = negative
      // Scale: each 5 points above/below par = ±2 adjustment
      const parDiff = rawFigure - parFigure;
      parAdjustment = Math.round((parDiff / 5) * 2);
      // Cap par adjustment at ±5
      parAdjustment = Math.max(-5, Math.min(5, parAdjustment));
    }
  }

  const totalAdjustment = tierAdj;
  const normalizedFigure = rawFigure + totalAdjustment;

  // Build reasoning string
  const parts: string[] = [];
  parts.push(`${rawFigure} at ${trackCode} (Tier ${tier}: ${tierName})`);

  if (tierAdj !== 0) {
    parts.push(`tier adj ${tierAdj > 0 ? '+' : ''}${tierAdj}`);
  }

  if (hasParData && parFigure !== null) {
    const parDiff = rawFigure - parFigure;
    if (parDiff > 0) {
      parts.push(`${parDiff}+ above par ${parFigure}`);
    } else if (parDiff < 0) {
      parts.push(`${Math.abs(parDiff)} below par ${parFigure}`);
    } else {
      parts.push(`at par ${parFigure}`);
    }
  }

  return {
    rawFigure,
    normalizedFigure,
    parFigure,
    tierAdjustment: tierAdj,
    parAdjustment,
    totalAdjustment,
    hasParData,
    reasoning: parts.join(' | '),
  };
}

// ============================================================================
// SHIPPER ANALYSIS
// ============================================================================

/**
 * Analyze a horse shipping between tracks and calculate adjustment
 *
 * When a horse runs at a track in a different tier than their recent races,
 * we apply an adjustment to account for the change in competition level.
 *
 * @param previousTrackCode - Track of most recent race(s)
 * @param currentTrackCode - Track of today's race
 * @returns Shipper analysis with adjustment
 */
export function analyzeShipper(
  previousTrackCode: string | null,
  currentTrackCode: string
): ShipperAnalysis {
  if (!previousTrackCode) {
    return {
      isShipping: false,
      fromTrack: null,
      fromTier: null,
      toTrack: currentTrackCode,
      toTier: getSpeedTier(currentTrackCode),
      tierChange: 0,
      adjustment: 0,
      reasoning: 'No previous track data',
    };
  }

  const fromTier = getSpeedTier(previousTrackCode);
  const toTier = getSpeedTier(currentTrackCode);
  // tierChange = toTier - fromTier
  // Positive = shipping down (to weaker tier, e.g., Tier 1 to Tier 4)
  // Negative = shipping up (to stronger tier, e.g., Tier 4 to Tier 1)
  const tierChange = toTier - fromTier;

  // Calculate adjustment
  // Dropping in tier (stronger to weaker): boost expectations
  // Rising in tier (weaker to stronger): lower expectations
  let adjustment = 0;
  let reasoning = '';

  if (tierChange === 0) {
    reasoning = `Same tier (${TIER_NAMES[fromTier]})`;
  } else if (tierChange > 0) {
    // Dropping down (e.g., Tier 1 to Tier 4) - easier competition
    adjustment = Math.min(5, tierChange * 2); // +2 per tier dropped, max +5
    reasoning = `Shipping down: ${previousTrackCode} (Tier ${fromTier}) → ${currentTrackCode} (Tier ${toTier}) +${adjustment}`;
  } else {
    // Stepping up (e.g., Tier 4 to Tier 1) - harder competition
    adjustment = Math.max(-6, tierChange * 2); // -2 per tier risen, max -6
    reasoning = `Shipping up: ${previousTrackCode} (Tier ${fromTier}) → ${currentTrackCode} (Tier ${toTier}) ${adjustment}`;
  }

  return {
    isShipping: tierChange !== 0,
    fromTrack: previousTrackCode,
    fromTier,
    toTrack: currentTrackCode,
    toTier,
    tierChange,
    adjustment,
    reasoning,
  };
}

/**
 * Get all tracks in a given speed tier
 */
export function getTracksInTier(tier: SpeedTier): string[] {
  switch (tier) {
    case 1:
      return Array.from(TIER_1_TRACKS);
    case 2:
      return Array.from(TIER_2_TRACKS);
    case 3:
      return Array.from(TIER_3_TRACKS);
    case 4:
      return Array.from(TIER_4_TRACKS);
    default:
      return [];
  }
}

/**
 * Get tier display info for UI
 */
export function getTierDisplayInfo(tier: SpeedTier): {
  name: string;
  color: string;
  adjustment: number;
} {
  const colors: Record<SpeedTier, string> = {
    1: '#22c55e', // Green - Elite
    2: '#3b82f6', // Blue - Strong
    3: '#a1a1aa', // Gray - Average
    4: '#f97316', // Orange - Weak
  };

  return {
    name: TIER_NAMES[tier],
    color: colors[tier],
    adjustment: TIER_ADJUSTMENTS[tier],
  };
}

// ============================================================================
// EXPORTS FOR CONVENIENCE
// ============================================================================

export { TIER_NAMES, TIER_ADJUSTMENTS };
