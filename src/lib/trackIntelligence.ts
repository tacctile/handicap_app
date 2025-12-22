/**
 * Track Intelligence Service
 * Provides functions to retrieve and analyze track-specific data
 */

import { trackDatabase, hasTrackData } from '../data/tracks';
import type {
  TrackData,
  PostPositionBias,
  SpeedBias,
  TrackBiasSummary,
  TrackMeasurements,
  SurfaceCharacteristics,
  SeasonalPattern,
} from '../data/tracks/trackSchema';

/**
 * Parse distance string to furlongs
 * Handles formats like "6F", "1M", "1M 1/16", "1 1/8M", etc.
 */
export function parseDistanceToFurlongs(distance: string): number {
  const normalized = distance.toUpperCase().trim();

  // Handle furlong formats: "6F", "5.5F", "6 1/2F"
  if (normalized.includes('F') && !normalized.includes('M')) {
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:(\d+)\/(\d+))?\s*F/);
    if (match && match[1]) {
      const whole = parseFloat(match[1]);
      const numerator = match[2] ? parseInt(match[2]) : 0;
      const denominator = match[3] ? parseInt(match[3]) : 1;
      return whole + numerator / denominator;
    }
  }

  // Handle mile formats: "1M", "1 1/8M", "1M 1/16", "1 1/4 Miles"
  if (normalized.includes('M')) {
    // Pattern for miles with fractions
    const match = normalized.match(/(\d+)\s*(?:(\d+)\/(\d+))?\s*M/);
    if (match && match[1]) {
      const wholeMiles = parseInt(match[1]);
      const numerator = match[2] ? parseInt(match[2]) : 0;
      const denominator = match[3] ? parseInt(match[3]) : 1;
      const totalMiles = wholeMiles + numerator / denominator;
      return totalMiles * 8; // 8 furlongs per mile
    }
  }

  // Default fallback - try to parse as number
  const numMatch = normalized.match(/(\d+(?:\.\d+)?)/);
  if (numMatch && numMatch[1]) {
    return parseFloat(numMatch[1]);
  }

  return 8; // Default to 1 mile if parsing fails
}

/**
 * Determine if a distance is a sprint or route
 */
export function getDistanceCategory(furlongs: number): 'sprint' | 'route' {
  return furlongs < 8 ? 'sprint' : 'route';
}

/**
 * Get track data by track code
 * Returns undefined if track is not in database
 */
export function getTrackData(trackCode: string): TrackData | undefined {
  return trackDatabase.get(trackCode.toUpperCase());
}

/**
 * Get post position bias data for a specific track, distance, and surface
 * Returns bias data or undefined if not available
 */
export function getPostPositionBias(
  trackCode: string,
  distance: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): PostPositionBias | undefined {
  const track = getTrackData(trackCode);
  if (!track) return undefined;

  const furlongs = parseDistanceToFurlongs(distance);
  const category = getDistanceCategory(furlongs);

  // Get biases for the surface
  let biases: PostPositionBias[] | undefined;
  if (surface === 'turf') {
    biases = track.postPositionBias.turf;
  } else {
    // dirt and synthetic use dirt biases
    biases = track.postPositionBias.dirt;
  }

  if (!biases) return undefined;

  // Find matching distance category
  return biases.find((b) => b.distance === category);
}

/**
 * Get speed bias data for a specific track and surface
 */
export function getSpeedBias(
  trackCode: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): SpeedBias | undefined {
  const track = getTrackData(trackCode);
  if (!track) return undefined;

  // For synthetic, try to find synthetic first, then fall back to dirt
  const surfaceToFind = surface === 'synthetic' ? 'dirt' : surface;

  return track.speedBias.find((b) => b.surface === surfaceToFind);
}

/**
 * Calculate post position score adjustment based on track bias
 * Returns a multiplier (0.5 to 1.5) to adjust the base post position score
 */
export function getPostPositionBiasMultiplier(
  trackCode: string,
  distance: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather',
  postPosition: number
): { multiplier: number; reasoning: string } {
  const bias = getPostPositionBias(trackCode, distance, surface);

  if (!bias) {
    return {
      multiplier: 1.0,
      reasoning: 'No track-specific data available',
    };
  }

  const postIndex = postPosition - 1;

  // Check if post position is in the win percentage array
  if (postIndex < 0 || postIndex >= bias.winPercentByPost.length) {
    return {
      multiplier: 0.8, // Outside posts get penalty
      reasoning: 'Outside post at this track',
    };
  }

  const winPct = bias.winPercentByPost[postIndex];
  if (winPct === undefined) {
    return {
      multiplier: 0.8,
      reasoning: 'Post position data not available',
    };
  }
  const avgWinPct = 100 / bias.winPercentByPost.length; // Fair share

  // Calculate multiplier based on how much better/worse than average
  // A post with 16% win rate vs 10% average gets a 1.6 multiplier
  // But we cap it to reasonable bounds
  let multiplier = winPct / avgWinPct;
  multiplier = Math.max(0.5, Math.min(1.5, multiplier));

  // Check if this is a favored post
  const isFavored = bias.favoredPosts.includes(postPosition);

  let reasoning: string;
  if (isFavored) {
    reasoning = `Favored post ${postPosition} at ${trackCode} (${bias.biasDescription})`;
  } else if (multiplier >= 1.0) {
    reasoning = `Post ${postPosition} performs average or better at ${trackCode}`;
  } else {
    reasoning = `Post ${postPosition} historically disadvantaged at ${trackCode}`;
  }

  return { multiplier, reasoning };
}

/**
 * Get a summary of track biases for display in UI
 */
export function getTrackBiasSummary(
  trackCode: string,
  distance: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): TrackBiasSummary {
  const track = getTrackData(trackCode);

  if (!track) {
    return {
      trackCode: trackCode.toUpperCase(),
      trackName: trackCode.toUpperCase(),
      speedBiasPercent: 50,
      speedBiasDescription: 'Track data not available',
      favoredPostsDescription: 'No data',
      isDataAvailable: false,
    };
  }

  const speedBias = getSpeedBias(trackCode, surface);
  const postBias = getPostPositionBias(trackCode, distance, surface);

  return {
    trackCode: track.code,
    trackName: track.name,
    speedBiasPercent: speedBias?.earlySpeedWinRate ?? 50,
    speedBiasDescription: speedBias?.description ?? 'No speed data',
    favoredPostsDescription: postBias
      ? `Posts ${postBias.favoredPosts.join('-')} favored`
      : 'No post data',
    isDataAvailable: true,
  };
}

/**
 * Check if track intelligence is available for a given track
 */
export function isTrackIntelligenceAvailable(trackCode: string): boolean {
  return hasTrackData(trackCode);
}

// ============================================================================
// NEW DATA POINT GETTERS
// ============================================================================

/**
 * Get track measurements for pace/distance analysis
 */
export function getTrackMeasurements(
  trackCode: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): TrackMeasurements | undefined {
  const track = getTrackData(trackCode);
  if (!track) return undefined;

  if (surface === 'turf' && track.measurements.turf) {
    return track.measurements.turf;
  }
  return track.measurements.dirt;
}

/**
 * Get surface characteristics for a track
 */
export function getSurfaceCharacteristics(
  trackCode: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): SurfaceCharacteristics | undefined {
  const track = getTrackData(trackCode);
  if (!track) return undefined;

  const surfaceType = surface === 'turf' ? 'turf' : 'dirt';
  return track.surfaces.find((s) => s.baseType === surfaceType);
}

/**
 * Get seasonal pattern for current month
 */
export function getSeasonalPattern(trackCode: string, month?: number): SeasonalPattern | undefined {
  const track = getTrackData(trackCode);
  if (!track) return undefined;

  const currentMonth = month ?? new Date().getMonth() + 1; // 1-12
  return track.seasonalPatterns.find((p) => p.months.includes(currentMonth));
}

/**
 * Get seasonal speed adjustment for current date
 * Returns adjustment value (positive = faster times expected, negative = slower)
 */
export function getSeasonalSpeedAdjustment(trackCode: string, month?: number): number {
  const pattern = getSeasonalPattern(trackCode, month);
  return pattern?.speedAdjustment ?? 0;
}

/**
 * Get par time for a specific distance, surface, and class level
 * Returns time in seconds, or undefined if not available
 */
export function getParTime(
  trackCode: string,
  furlongs: number,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather',
  classLevel: 'claiming' | 'allowance' | 'stakes'
): number | undefined {
  const track = getTrackData(trackCode);
  if (!track) return undefined;

  const surfaceType = surface === 'turf' ? 'turf' : 'dirt';

  // Find closest distance match
  const distanceData = track.winningTimes.find(
    (wt) => Math.abs(wt.furlongs - furlongs) < 0.5 && wt.surface === surfaceType
  );

  if (!distanceData) return undefined;

  switch (classLevel) {
    case 'claiming':
      return distanceData.claimingAvg;
    case 'allowance':
      return distanceData.allowanceAvg;
    case 'stakes':
      return distanceData.stakesAvg;
    default:
      return distanceData.allowanceAvg;
  }
}

/**
 * Calculate speed figure adjustment based on par time comparison
 * Returns points to add/subtract from speed score
 * Positive = faster than par, Negative = slower than par
 */
export function calculateParTimeAdjustment(
  trackCode: string,
  furlongs: number,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather',
  classLevel: 'claiming' | 'allowance' | 'stakes',
  actualTime: number
): { adjustment: number; reasoning: string } {
  const parTime = getParTime(trackCode, furlongs, surface, classLevel);

  if (!parTime || !actualTime || actualTime <= 0) {
    return { adjustment: 0, reasoning: 'Par time data not available' };
  }

  // Calculate difference in seconds
  const diff = parTime - actualTime; // Positive = faster than par

  // Convert to adjustment points (roughly 1 point per 0.2 seconds)
  // Cap at ±10 points
  const rawAdjustment = diff * 5;
  const adjustment = Math.max(-10, Math.min(10, Math.round(rawAdjustment)));

  let reasoning: string;
  if (adjustment > 0) {
    reasoning = `${Math.abs(diff).toFixed(2)}s faster than ${trackCode} par`;
  } else if (adjustment < 0) {
    reasoning = `${Math.abs(diff).toFixed(2)}s slower than ${trackCode} par`;
  } else {
    reasoning = `At ${trackCode} par time`;
  }

  return { adjustment, reasoning };
}

/**
 * Get stretch length factor for closer analysis
 * Returns multiplier: >1 favors closers, <1 penalizes closers
 */
export function getStretchLengthFactor(
  trackCode: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): { factor: number; stretchLength: number; reasoning: string } {
  const measurements = getTrackMeasurements(trackCode, surface);

  if (!measurements) {
    return { factor: 1.0, stretchLength: 0, reasoning: 'No measurement data' };
  }

  const stretch = measurements.stretchLength;

  // Industry average stretch is ~1000 feet
  // Long stretch (1100+): closers benefit
  // Short stretch (<900): closers penalized
  let factor: number;
  let reasoning: string;

  if (stretch >= 1100) {
    factor = 1.15; // 15% bonus for closers
    reasoning = `Long stretch (${stretch}ft) favors closers`;
  } else if (stretch >= 1000) {
    factor = 1.05;
    reasoning = `Average stretch (${stretch}ft)`;
  } else if (stretch >= 900) {
    factor = 0.95;
    reasoning = `Short stretch (${stretch}ft) hurts closers`;
  } else {
    factor = 0.85; // 15% penalty for very short
    reasoning = `Very short stretch (${stretch}ft) severely hurts closers`;
  }

  return { factor, stretchLength: stretch, reasoning };
}

/**
 * Get drainage factor for wet track analysis
 * Returns multiplier for wet track specialist bonus
 */
export function getDrainageFactor(
  trackCode: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): { factor: number; drainage: string; reasoning: string } {
  const surfaceData = getSurfaceCharacteristics(trackCode, surface);

  if (!surfaceData) {
    return { factor: 1.0, drainage: 'unknown', reasoning: 'No surface data' };
  }

  const drainage = surfaceData.drainage;

  // Poor drainage = wet conditions last longer = wet track history matters more
  let factor: number;
  let reasoning: string;

  switch (drainage) {
    case 'poor':
      factor = 1.5; // 50% boost to wet track bonus
      reasoning = 'Poor drainage - wet conditions persist, mudders get extra boost';
      break;
    case 'fair':
      factor = 1.25;
      reasoning = 'Fair drainage - moderate wet track impact';
      break;
    case 'good':
      factor = 1.0;
      reasoning = 'Good drainage - standard wet track scoring';
      break;
    case 'excellent':
      factor = 0.75; // Reduced bonus - track dries quickly
      reasoning = 'Excellent drainage - track dries fast, wet history less relevant';
      break;
    default:
      factor = 1.0;
      reasoning = 'Standard wet track scoring';
  }

  return { factor, drainage, reasoning };
}
