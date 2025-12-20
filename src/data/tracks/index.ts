/**
 * Track Intelligence Database
 * Contains track-specific data for handicapping calculations
 *
 * This module exports a centralized database of track intelligence data
 * for 32 major tracks in North American racing. Each track file contains
 * verified, researched data from authoritative sources including:
 * - Equibase track profiles and records
 * - Official track websites and specifications
 * - America's Best Racing handicapping analysis
 * - NYRA and other racing association statistics
 * - Racing publications (BloodHorse, Horse Racing Nation, TwinSpires)
 * - State racing commission data (Nebraska Racing Commission for FON, NJRC for MTH)
 * - Pennsylvania Horse Racing Commission (PRX, PEN)
 * - Maryland Racing Commission (LRL, PIM)
 * - Delaware Racing Commission (DEL)
 * - West Virginia Racing Commission (CT, MNR)
 * - Florida Division of Pari-Mutuel Wagering (TAM)
 * - Louisiana State Racing Commission (FG, DED, EVD)
 * - Kentucky Horse Racing Commission (TP, ELP)
 * - Texas Racing Commission (LS, HOU)
 * - Oklahoma Horse Racing Commission (RP)
 * - Minnesota Racing Commission (CBY)
 * - Iowa Racing and Gaming Commission (PRM)
 * - Indiana Horse Racing Commission (IND, HOO)
 *
 * Track codes follow standard DRF/Equibase conventions:
 * - AQU = Aqueduct Racetrack
 * - BEL = Belmont Park
 * - CBY = Canterbury Park
 * - CD = Churchill Downs
 * - CT = Charles Town Races
 * - DED = Delta Downs Racetrack Casino & Hotel
 * - DEL = Delaware Park
 * - DMR = Del Mar Thoroughbred Club
 * - ELP = Ellis Park Race Course
 * - EVD = Evangeline Downs Racetrack & Casino
 * - FG = Fair Grounds Race Course
 * - FL = Finger Lakes Gaming & Racetrack
 * - FON = Fonner Park
 * - GP = Gulfstream Park
 * - HOO = Hoosier Park Racing & Casino
 * - HOU = Sam Houston Race Park
 * - IND = Indiana Grand Racing & Casino
 * - KEE = Keeneland Race Course
 * - LRL = Laurel Park
 * - LS = Lone Star Park
 * - MNR = Mountaineer Casino Racetrack & Resort
 * - MTH = Monmouth Park
 * - OP = Oaklawn Racing Casino Resort
 * - PEN = Penn National Race Course
 * - PIM = Pimlico Race Course
 * - PRM = Prairie Meadows Racetrack & Casino
 * - PRX = Parx Racing
 * - RP = Remington Park
 * - SA = Santa Anita Park
 * - SAR = Saratoga Race Course
 * - TAM = Tampa Bay Downs
 * - TP = Turfway Park
 */

import type { TrackData, TrackBiasSummary } from './trackSchema'

// Import individual track data files (alphabetical order)
import { aqueduct } from './aqueduct'
import { belmontPark } from './belmontPark'
import { canterburyPark } from './canterburyPark'
import { charlesTownRaces } from './charlesTownRaces'
import { churchillDowns } from './churchillDowns'
import { delawarePark } from './delawarePark'
import { deltaDowns } from './deltaDowns'
import { delMar } from './delMar'
import { ellisPark } from './ellisPark'
import { evangelineDowns } from './evangelineDowns'
import { fairGrounds } from './fairGrounds'
import { fingerLakes } from './fingerLakes'
import { fonnerPark } from './fonnerPark'
import { gulfstreamPark } from './gulfstreamPark'
import { hoosierPark } from './hoosierPark'
import { indianaGrand } from './indianaGrand'
import { keeneland } from './keeneland'
import { laurelPark } from './laurelPark'
import { loneStarPark } from './loneStarPark'
import { monmouthPark } from './monmouthPark'
import { mountaineer } from './mountaineer'
import { oaklawnPark } from './oaklawnPark'
import { parxRacing } from './parxRacing'
import { pennNational } from './pennNational'
import { pimlico } from './pimlico'
import { prairieMeadows } from './prairieMeadows'
import { remingtonPark } from './remingtonPark'
import { samHoustonRacePark } from './samHoustonRacePark'
import { santaAnita } from './santaAnita'
import { saratoga } from './saratoga'
import { tampaBayDowns } from './tampaBayDowns'
import { turfwayPark } from './turfwayPark'

/**
 * Track database indexed by standard track code
 * Keys use DRF/Equibase standard codes for consistency with DRF file parsing
 */
export const trackDatabase: Map<string, TrackData> = new Map([
  ['AQU', aqueduct],
  ['BEL', belmontPark],
  ['CBY', canterburyPark],
  ['CD', churchillDowns],
  ['CT', charlesTownRaces],
  ['DED', deltaDowns],
  ['DEL', delawarePark],
  ['DMR', delMar],
  ['ELP', ellisPark],
  ['EVD', evangelineDowns],
  ['FG', fairGrounds],
  ['FL', fingerLakes],
  ['FON', fonnerPark],
  ['GP', gulfstreamPark],
  ['HOO', hoosierPark],
  ['HOU', samHoustonRacePark],
  ['IND', indianaGrand],
  ['KEE', keeneland],
  ['LRL', laurelPark],
  ['LS', loneStarPark],
  ['MNR', mountaineer],
  ['MTH', monmouthPark],
  ['OP', oaklawnPark],
  ['PEN', pennNational],
  ['PIM', pimlico],
  ['PRM', prairieMeadows],
  ['PRX', parxRacing],
  ['RP', remingtonPark],
  ['SA', santaAnita],
  ['SAR', saratoga],
  ['TAM', tampaBayDowns],
  ['TP', turfwayPark]
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
  canterburyPark,
  charlesTownRaces,
  churchillDowns,
  delawarePark,
  deltaDowns,
  delMar,
  ellisPark,
  evangelineDowns,
  fairGrounds,
  fingerLakes,
  fonnerPark,
  gulfstreamPark,
  hoosierPark,
  indianaGrand,
  keeneland,
  laurelPark,
  loneStarPark,
  monmouthPark,
  mountaineer,
  oaklawnPark,
  parxRacing,
  pennNational,
  pimlico,
  prairieMeadows,
  remingtonPark,
  samHoustonRacePark,
  santaAnita,
  saratoga,
  tampaBayDowns,
  turfwayPark
}
