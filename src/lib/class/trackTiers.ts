/**
 * Track Tier Classifications
 *
 * Classifies racetracks by quality/prestige level.
 * Track tier movement is a key component of hidden class drops.
 *
 * Tier A: Premier tracks - highest quality racing
 * Tier B: Good tracks - solid competition
 * Tier C: Regional tracks - lower level competition
 */

import type { TrackTier, TrackTierMovement } from './classTypes'

// ============================================================================
// TRACK TIER DEFINITIONS
// ============================================================================

export interface TrackInfo {
  /** Track code (e.g., "SAR", "CD") */
  code: string
  /** Full track name */
  name: string
  /** Track tier */
  tier: TrackTier
  /** State */
  state: string
  /** Brief notes */
  notes?: string
}

/**
 * Tier A Tracks - Premier venues with highest quality racing
 * Kentucky Derby prep tracks, Breeders' Cup hosts, major meets
 */
export const TIER_A_TRACKS: TrackInfo[] = [
  { code: 'SAR', name: 'Saratoga', tier: 'A', state: 'NY', notes: 'Premier summer meet' },
  { code: 'BEL', name: 'Belmont Park', tier: 'A', state: 'NY', notes: 'Belmont Stakes' },
  { code: 'AQU', name: 'Aqueduct', tier: 'A', state: 'NY', notes: 'Big A, NY winter' },
  { code: 'CD', name: 'Churchill Downs', tier: 'A', state: 'KY', notes: 'Kentucky Derby' },
  { code: 'KEE', name: 'Keeneland', tier: 'A', state: 'KY', notes: 'Premier meets' },
  { code: 'DMR', name: 'Del Mar', tier: 'A', state: 'CA', notes: 'Where turf meets surf' },
  { code: 'SA', name: 'Santa Anita', tier: 'A', state: 'CA', notes: "Great Race Place" },
  { code: 'GP', name: 'Gulfstream Park', tier: 'A', state: 'FL', notes: 'Florida Derby' },
  { code: 'OP', name: 'Oaklawn Park', tier: 'A', state: 'AR', notes: 'Arkansas Derby' },
  { code: 'PIM', name: 'Pimlico', tier: 'A', state: 'MD', notes: 'Preakness Stakes' },
  { code: 'MTH', name: 'Monmouth Park', tier: 'A', state: 'NJ', notes: 'Haskell' },
]

/**
 * Tier B Tracks - Good quality racing, competitive fields
 */
export const TIER_B_TRACKS: TrackInfo[] = [
  { code: 'LRL', name: 'Laurel Park', tier: 'B', state: 'MD' },
  { code: 'TAM', name: 'Tampa Bay Downs', tier: 'B', state: 'FL' },
  { code: 'FG', name: 'Fair Grounds', tier: 'B', state: 'LA' },
  { code: 'WO', name: 'Woodbine', tier: 'B', state: 'ON', notes: 'Canada flagship' },
  { code: 'IND', name: 'Indiana Grand', tier: 'B', state: 'IN' },
  { code: 'PRM', name: 'Prairie Meadows', tier: 'B', state: 'IA' },
  { code: 'HAW', name: 'Hawthorne', tier: 'B', state: 'IL' },
  { code: 'AP', name: 'Arlington Park', tier: 'B', state: 'IL', notes: 'Closed 2021' },
  { code: 'DEL', name: 'Delaware Park', tier: 'B', state: 'DE' },
  { code: 'PRX', name: 'Parx Racing', tier: 'B', state: 'PA' },
  { code: 'PEN', name: 'Penn National', tier: 'B', state: 'PA' },
  { code: 'TDN', name: 'Thistledown', tier: 'B', state: 'OH' },
  { code: 'RP', name: 'Remington Park', tier: 'B', state: 'OK' },
  { code: 'CT', name: 'Charles Town', tier: 'B', state: 'WV' },
  { code: 'EVD', name: 'Evangeline Downs', tier: 'B', state: 'LA' },
  { code: 'LAD', name: 'Louisiana Downs', tier: 'B', state: 'LA' },
  { code: 'GG', name: 'Golden Gate Fields', tier: 'B', state: 'CA' },
  { code: 'LS', name: 'Lone Star Park', tier: 'B', state: 'TX' },
  { code: 'SAM', name: 'Sam Houston', tier: 'B', state: 'TX' },
  { code: 'RET', name: 'Retama Park', tier: 'B', state: 'TX' },
  { code: 'EMD', name: 'Emerald Downs', tier: 'B', state: 'WA' },
  { code: 'ASD', name: 'Arizona Downs', tier: 'B', state: 'AZ' },
  { code: 'TUP', name: 'Turf Paradise', tier: 'B', state: 'AZ' },
  { code: 'MVR', name: 'Mountaineer', tier: 'B', state: 'WV' },
  { code: 'GPW', name: 'Gulfstream Park West', tier: 'B', state: 'FL' },
]

/**
 * Tier C Tracks - Smaller regional tracks, lower level competition
 */
export const TIER_C_TRACKS: TrackInfo[] = [
  { code: 'FL', name: 'Finger Lakes', tier: 'C', state: 'NY' },
  { code: 'BTP', name: 'Belterra Park', tier: 'C', state: 'OH' },
  { code: 'FON', name: 'Fonner Park', tier: 'C', state: 'NE' },
  { code: 'MNR', name: 'Mahoning Valley', tier: 'C', state: 'OH' },
  { code: 'SUN', name: 'Sunland Park', tier: 'C', state: 'NM' },
  { code: 'RUI', name: 'Ruidoso Downs', tier: 'C', state: 'NM' },
  { code: 'ZIA', name: 'Zia Park', tier: 'C', state: 'NM' },
  { code: 'WYO', name: 'Wyoming Downs', tier: 'C', state: 'WY' },
  { code: 'GRM', name: 'Grants Pass', tier: 'C', state: 'OR' },
  { code: 'PM', name: 'Portland Meadows', tier: 'C', state: 'OR' },
  { code: 'ALB', name: 'Albuquerque', tier: 'C', state: 'NM' },
  { code: 'CBY', name: 'Canterbury Park', tier: 'C', state: 'MN' },
  { code: 'CPW', name: 'Caymanas Park', tier: 'C', state: 'JM' },
  { code: 'FPX', name: 'Fairmount Park', tier: 'C', state: 'IL' },
  { code: 'FMT', name: 'Fort Erie', tier: 'C', state: 'ON' },
  { code: 'AJX', name: 'Ajax Downs', tier: 'C', state: 'ON' },
  { code: 'HST', name: 'Hastings', tier: 'C', state: 'BC' },
  { code: 'NP', name: 'Northlands Park', tier: 'C', state: 'AB' },
  { code: 'ASI', name: 'Assiniboia Downs', tier: 'C', state: 'MB' },
  { code: 'CTP', name: 'Century Downs', tier: 'C', state: 'AB' },
  { code: 'WBS', name: 'Woodbine Mohawk Park', tier: 'C', state: 'ON' },
]

// ============================================================================
// TRACK LOOKUP
// ============================================================================

/**
 * All tracks indexed by code
 */
const ALL_TRACKS: Map<string, TrackInfo> = new Map()

// Populate the map
;[...TIER_A_TRACKS, ...TIER_B_TRACKS, ...TIER_C_TRACKS].forEach(track => {
  ALL_TRACKS.set(track.code.toUpperCase(), track)
})

/**
 * Get track tier by code
 */
export function getTrackTier(trackCode: string): TrackTier {
  const track = ALL_TRACKS.get(trackCode.toUpperCase())
  return track?.tier ?? 'C' // Default to tier C for unknown tracks
}

/**
 * Get track info by code
 */
export function getTrackInfo(trackCode: string): TrackInfo | null {
  return ALL_TRACKS.get(trackCode.toUpperCase()) ?? null
}

/**
 * Check if track is tier A (premier)
 */
export function isTierATrack(trackCode: string): boolean {
  return getTrackTier(trackCode) === 'A'
}

/**
 * Check if track is tier C (regional)
 */
export function isTierCTrack(trackCode: string): boolean {
  return getTrackTier(trackCode) === 'C'
}

// ============================================================================
// TRACK TIER MOVEMENT ANALYSIS
// ============================================================================

/**
 * Calculate track tier movement between races
 * Returns null if same tier or no movement
 */
export function analyzeTrackTierMovement(
  previousTrackCode: string,
  currentTrackCode: string
): TrackTierMovement | null {
  const fromTier = getTrackTier(previousTrackCode)
  const toTier = getTrackTier(currentTrackCode)

  // No movement if same tier
  if (fromTier === toTier) {
    return null
  }

  // Calculate tier movement
  const tierValues: Record<TrackTier, number> = { A: 3, B: 2, C: 1 }
  const tierDiff = tierValues[fromTier] - tierValues[toTier]

  let description: string
  let pointsAdjustment: number

  if (tierDiff > 0) {
    // Dropping in tier (A→B, A→C, B→C) - favorable
    if (fromTier === 'A' && toTier === 'C') {
      description = `Major tier drop: ${previousTrackCode} (A) → ${currentTrackCode} (C)`
      pointsAdjustment = 8
    } else if (fromTier === 'A' && toTier === 'B') {
      description = `Tier drop: ${previousTrackCode} (A) → ${currentTrackCode} (B)`
      pointsAdjustment = 4
    } else {
      // B→C
      description = `Tier drop: ${previousTrackCode} (B) → ${currentTrackCode} (C)`
      pointsAdjustment = 5
    }
  } else {
    // Rising in tier (C→B, C→A, B→A) - challenging
    if (fromTier === 'C' && toTier === 'A') {
      description = `Major tier rise: ${previousTrackCode} (C) → ${currentTrackCode} (A)`
      pointsAdjustment = -6
    } else if (fromTier === 'B' && toTier === 'A') {
      description = `Tier rise: ${previousTrackCode} (B) → ${currentTrackCode} (A)`
      pointsAdjustment = -3
    } else {
      // C→B
      description = `Tier rise: ${previousTrackCode} (C) → ${currentTrackCode} (B)`
      pointsAdjustment = -2
    }
  }

  return {
    fromTier,
    toTier,
    fromTrack: previousTrackCode.toUpperCase(),
    toTrack: currentTrackCode.toUpperCase(),
    description,
    pointsAdjustment,
  }
}

/**
 * Get tier display color
 */
export function getTierColor(tier: TrackTier): string {
  switch (tier) {
    case 'A':
      return '#fbbf24' // Gold
    case 'B':
      return '#94a3b8' // Silver
    case 'C':
      return '#a8a29e' // Bronze/stone
    default:
      return '#6b7280'
  }
}

/**
 * Get tier display name
 */
export function getTierDisplayName(tier: TrackTier): string {
  switch (tier) {
    case 'A':
      return 'Premier'
    case 'B':
      return 'Quality'
    case 'C':
      return 'Regional'
    default:
      return 'Unknown'
  }
}

/**
 * Get all tracks for a specific tier
 */
export function getTracksByTier(tier: TrackTier): TrackInfo[] {
  switch (tier) {
    case 'A':
      return [...TIER_A_TRACKS]
    case 'B':
      return [...TIER_B_TRACKS]
    case 'C':
      return [...TIER_C_TRACKS]
    default:
      return []
  }
}

/**
 * Check if shipper from elite (tier A) track to lower tier
 */
export function isShipperFromElite(
  previousTrackCode: string,
  currentTrackCode: string
): boolean {
  const fromTier = getTrackTier(previousTrackCode)
  const toTier = getTrackTier(currentTrackCode)
  return fromTier === 'A' && (toTier === 'B' || toTier === 'C')
}
