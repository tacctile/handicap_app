/**
 * Track Intelligence Database
 * Contains track-specific data for handicapping calculations
 *
 * This module exports a centralized database of track intelligence data
 * for 11 major tracks in North American racing. Each track file contains
 * verified, researched data from authoritative sources including:
 * - Equibase track profiles and records
 * - Official track websites and specifications
 * - America's Best Racing handicapping analysis
 * - NYRA and other racing association statistics
 * - Racing publications (BloodHorse, Horse Racing Nation, TwinSpires)
 * - State racing commission data (Nebraska Racing Commission for FON)
 *
 * Track codes follow standard DRF/Equibase conventions:
 * - AQU = Aqueduct Racetrack
 * - BEL = Belmont Park
 * - CD = Churchill Downs
 * - DMR = Del Mar Thoroughbred Club
 * - FON = Fonner Park
 * - GP = Gulfstream Park
 * - KEE = Keeneland Race Course
 * - OP = Oaklawn Racing Casino Resort
 * - PIM = Pimlico Race Course
 * - SA = Santa Anita Park
 * - SAR = Saratoga Race Course
 */

import type { TrackData, TrackBiasSummary } from './trackSchema'

// Import individual track data files (alphabetical order)
import { aqueduct } from './aqueduct'
import { belmontPark } from './belmontPark'
import { churchillDowns } from './churchillDowns'
import { delMar } from './delMar'
import { fonnerPark } from './fonnerPark'
import { gulfstreamPark } from './gulfstreamPark'
import { keeneland } from './keeneland'
import { oaklawnPark } from './oaklawnPark'
import { pimlico } from './pimlico'
import { santaAnita } from './santaAnita'
import { saratoga } from './saratoga'

/**
 * Track database indexed by standard track code
 * Keys use DRF/Equibase standard codes for consistency with DRF file parsing
 */
export const trackDatabase: Map<string, TrackData> = new Map([
  ['AQU', aqueduct],
  ['BEL', belmontPark],
  ['CD', churchillDowns],
  ['DMR', delMar],
  ['FON', fonnerPark],
  ['GP', gulfstreamPark],
  ['KEE', keeneland],
  ['OP', oaklawnPark],
  ['PIM', pimlico],
  ['SA', santaAnita],
  ['SAR', saratoga]
])

/**
 * Get list of all available track codes
 */
export function getAvailableTrackCodes(): string[] {
  return Array.from(trackDatabase.keys())
}

/**
 * Check if a track exists in the database
 * @param trackCode - Standard track code (e.g., "CD", "SAR")
 * @returns true if track data exists
 */
export function hasTrackData(trackCode: string): boolean {
  return trackDatabase.has(trackCode.toUpperCase())
}

/**
 * Get track data by code
 * @param trackCode - Standard track code (e.g., "CD", "SAR")
 * @returns TrackData or undefined if not found
 */
export function getTrackData(trackCode: string): TrackData | undefined {
  return trackDatabase.get(trackCode.toUpperCase())
}

/**
 * Get a simplified track bias summary for UI display
 * @param trackCode - Standard track code
 * @returns TrackBiasSummary for display purposes
 */
export function getTrackBiasSummary(trackCode: string): TrackBiasSummary | null {
  const track = trackDatabase.get(trackCode.toUpperCase())
  if (!track) {
    return null
  }

  // Get the primary dirt speed bias
  const dirtBias = track.speedBias.find(b => b.surface === 'dirt')

  return {
    trackCode: track.code,
    trackName: track.name,
    speedBiasPercent: dirtBias?.earlySpeedWinRate ?? 50,
    speedBiasDescription: dirtBias?.description ?? 'No bias data available',
    favoredPostsDescription: track.postPositionBias.dirt[0]?.biasDescription ?? 'No post position data',
    isDataAvailable: true
  }
}

/**
 * Get fallback track data for unknown tracks
 * Returns neutral defaults with reduced confidence
 */
export function getFallbackTrackData(trackCode: string): TrackData {
  return {
    code: trackCode.toUpperCase(),
    name: `Unknown Track (${trackCode.toUpperCase()})`,
    location: 'Unknown',
    state: 'XX',
    measurements: {
      dirt: {
        circumference: 1.0,
        stretchLength: 1000,
        turnRadius: 280,
        trackWidth: 80,
        chutes: [6, 7]
      }
    },
    postPositionBias: {
      dirt: [
        {
          distance: 'sprint',
          minFurlongs: 5,
          maxFurlongs: 7,
          winPercentByPost: [10, 12, 14, 16, 15, 13, 11, 9],
          favoredPosts: [4, 5],
          biasDescription: 'Using national average defaults - middle posts typically favored'
        },
        {
          distance: 'route',
          minFurlongs: 8,
          maxFurlongs: 12,
          winPercentByPost: [11, 13, 14, 15, 16, 13, 10, 8],
          favoredPosts: [5],
          biasDescription: 'Using national average defaults - middle posts typically favored in routes'
        }
      ]
    },
    speedBias: [
      {
        surface: 'dirt',
        earlySpeedWinRate: 55,
        paceAdvantageRating: 5,
        description: 'National average defaults - slight speed advantage typical'
      }
    ],
    surfaces: [
      {
        baseType: 'dirt',
        composition: 'Unknown - using typical dirt track assumptions',
        playingStyle: 'fair',
        drainage: 'good'
      }
    ],
    seasonalPatterns: [],
    winningTimes: [
      { distance: '6f', furlongs: 6, surface: 'dirt', claimingAvg: 70.5, allowanceAvg: 69.0, stakesAvg: 67.5 },
      { distance: '1m', furlongs: 8, surface: 'dirt', claimingAvg: 96.5, allowanceAvg: 95.0, stakesAvg: 93.5 }
    ],
    lastUpdated: new Date().toISOString().split('T')[0],
    dataQuality: 'estimated'
  }
}

// Re-export types for convenience
export type {
  TrackData,
  PostPositionBias,
  SpeedBias,
  TrackMeasurements,
  SurfaceCharacteristics,
  SeasonalPattern,
  WinningTimeByDistance,
  TrackBiasSummary
} from './trackSchema'

// Export individual track data for direct access if needed (alphabetical order)
export {
  aqueduct,
  belmontPark,
  churchillDowns,
  delMar,
  fonnerPark,
  gulfstreamPark,
  keeneland,
  oaklawnPark,
  pimlico,
  santaAnita,
  saratoga
}
