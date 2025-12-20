/**
 * Track Intelligence Service
 * Provides functions to retrieve and analyze track-specific data
 */

import { trackDatabase, hasTrackData } from '../data/tracks'
import type {
  TrackData,
  PostPositionBias,
  SpeedBias,
  TrackBiasSummary
} from '../data/tracks/trackSchema'

/**
 * Parse distance string to furlongs
 * Handles formats like "6F", "1M", "1M 1/16", "1 1/8M", etc.
 */
export function parseDistanceToFurlongs(distance: string): number {
  const normalized = distance.toUpperCase().trim()

  // Handle furlong formats: "6F", "5.5F", "6 1/2F"
  if (normalized.includes('F') && !normalized.includes('M')) {
    const match = normalized.match(/(\d+(?:\.\d+)?)\s*(?:(\d+)\/(\d+))?\s*F/)
    if (match) {
      const whole = parseFloat(match[1])
      const numerator = match[2] ? parseInt(match[2]) : 0
      const denominator = match[3] ? parseInt(match[3]) : 1
      return whole + numerator / denominator
    }
  }

  // Handle mile formats: "1M", "1 1/8M", "1M 1/16", "1 1/4 Miles"
  if (normalized.includes('M')) {
    // Pattern for miles with fractions
    const match = normalized.match(/(\d+)\s*(?:(\d+)\/(\d+))?\s*M/)
    if (match) {
      const wholeMiles = parseInt(match[1])
      const numerator = match[2] ? parseInt(match[2]) : 0
      const denominator = match[3] ? parseInt(match[3]) : 1
      const totalMiles = wholeMiles + numerator / denominator
      return totalMiles * 8 // 8 furlongs per mile
    }
  }

  // Default fallback - try to parse as number
  const numMatch = normalized.match(/(\d+(?:\.\d+)?)/)
  if (numMatch) {
    return parseFloat(numMatch[1])
  }

  return 8 // Default to 1 mile if parsing fails
}

/**
 * Determine if a distance is a sprint or route
 */
export function getDistanceCategory(furlongs: number): 'sprint' | 'route' {
  return furlongs < 8 ? 'sprint' : 'route'
}

/**
 * Get track data by track code
 * Returns undefined if track is not in database
 */
export function getTrackData(trackCode: string): TrackData | undefined {
  return trackDatabase.get(trackCode.toUpperCase())
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
  const track = getTrackData(trackCode)
  if (!track) return undefined

  const furlongs = parseDistanceToFurlongs(distance)
  const category = getDistanceCategory(furlongs)

  // Get biases for the surface
  let biases: PostPositionBias[] | undefined
  if (surface === 'turf') {
    biases = track.postPositionBias.turf
  } else {
    // dirt and synthetic use dirt biases
    biases = track.postPositionBias.dirt
  }

  if (!biases) return undefined

  // Find matching distance category
  return biases.find((b) => b.distance === category)
}

/**
 * Get speed bias data for a specific track and surface
 */
export function getSpeedBias(
  trackCode: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): SpeedBias | undefined {
  const track = getTrackData(trackCode)
  if (!track) return undefined

  // For synthetic, try to find synthetic first, then fall back to dirt
  const surfaceToFind = surface === 'synthetic' ? 'dirt' : surface

  return track.speedBias.find((b) => b.surface === surfaceToFind)
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
  const bias = getPostPositionBias(trackCode, distance, surface)

  if (!bias) {
    return {
      multiplier: 1.0,
      reasoning: 'No track-specific data available'
    }
  }

  const postIndex = postPosition - 1

  // Check if post position is in the win percentage array
  if (postIndex < 0 || postIndex >= bias.winPercentByPost.length) {
    return {
      multiplier: 0.8, // Outside posts get penalty
      reasoning: 'Outside post at this track'
    }
  }

  const winPct = bias.winPercentByPost[postIndex]
  const avgWinPct = 100 / bias.winPercentByPost.length // Fair share

  // Calculate multiplier based on how much better/worse than average
  // A post with 16% win rate vs 10% average gets a 1.6 multiplier
  // But we cap it to reasonable bounds
  let multiplier = winPct / avgWinPct
  multiplier = Math.max(0.5, Math.min(1.5, multiplier))

  // Check if this is a favored post
  const isFavored = bias.favoredPosts.includes(postPosition)

  let reasoning: string
  if (isFavored) {
    reasoning = `Favored post ${postPosition} at ${trackCode} (${bias.biasDescription})`
  } else if (multiplier >= 1.0) {
    reasoning = `Post ${postPosition} performs average or better at ${trackCode}`
  } else {
    reasoning = `Post ${postPosition} historically disadvantaged at ${trackCode}`
  }

  return { multiplier, reasoning }
}

/**
 * Get a summary of track biases for display in UI
 */
export function getTrackBiasSummary(
  trackCode: string,
  distance: string,
  surface: 'dirt' | 'turf' | 'synthetic' | 'all-weather'
): TrackBiasSummary {
  const track = getTrackData(trackCode)

  if (!track) {
    return {
      trackCode: trackCode.toUpperCase(),
      trackName: trackCode.toUpperCase(),
      speedBiasPercent: 50,
      speedBiasDescription: 'Track data not available',
      favoredPostsDescription: 'No data',
      isDataAvailable: false
    }
  }

  const speedBias = getSpeedBias(trackCode, surface)
  const postBias = getPostPositionBias(trackCode, distance, surface)

  return {
    trackCode: track.code,
    trackName: track.name,
    speedBiasPercent: speedBias?.earlySpeedWinRate ?? 50,
    speedBiasDescription: speedBias?.description ?? 'No speed data',
    favoredPostsDescription: postBias
      ? `Posts ${postBias.favoredPosts.join('-')} favored`
      : 'No post data',
    isDataAvailable: true
  }
}

/**
 * Check if track intelligence is available for a given track
 */
export function isTrackIntelligenceAvailable(trackCode: string): boolean {
  return hasTrackData(trackCode)
}
